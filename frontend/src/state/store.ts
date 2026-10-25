import { useSyncExternalStore } from 'react'
import { initialState } from './data'
import { autoPick, commitPick, shuffled } from './engine'
import { recoverState } from './persistence'
import type { AppState, FplSetup, League } from './types'

export const STORAGE_KEY = 'sports-fanatics:v1'
const listeners = new Set<() => void>()
let storageWarning = ''
function readState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const { state: restored, recovered } = recoverState(JSON.parse(saved))
      if (recovered) {
        storageWarning =
          'Some saved data was repaired. Valid leagues were preserved; a recovery backup is available in browser storage.'
        try {
          localStorage.setItem(`${STORAGE_KEY}:recovery-backup`, saved)
        } catch {
          /* Read-only storage still permits in-memory recovery. */
        }
      }
      return restored
    }
  } catch {
    storageWarning =
      'Browser storage is unavailable or unreadable. Changes will last for this visit only.'
  }
  return initialState()
}
let state = readState()
function update(transform: (current: AppState) => AppState): Promise<{ persisted: boolean }> {
  const commit = () => {
    let current = state
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) current = recoverState(JSON.parse(saved)).state
    } catch {
      /* Use the current session when storage is unavailable. */
    }
    state = transform(current)
    let persisted = true
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      persisted = false
      storageWarning = 'Browser storage is unavailable. Changes will last for this visit only.'
    }
    listeners.forEach((listener) => listener())
    return { persisted }
  }
  // Serialize read-modify-write across tabs where Web Locks are available.
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(STORAGE_KEY, commit)
    : Promise.resolve(commit())
}
function updateLeague(id: string, transform: (league: League) => League) {
  return update((current) => ({
    ...current,
    leagues: current.leagues.map((l) => (l.id === id ? transform(l) : l)),
  }))
}
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return
    state = readState()
    listeners.forEach((listener) => listener())
  })
export function useStore() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}
export const getStorageWarning = () => storageWarning
export const actions = {
  addLeague(league: League) {
    return update((current) => ({ ...current, leagues: [...current.leagues, league] }))
  },
  addGuest(id: string, name: string, team: string) {
    return updateLeague(id, (l) =>
      l.status !== 'lobby' || l.ownerId !== l.userId || l.participants.length >= l.capacity
        ? l
        : {
            ...l,
            participants: [...l.participants, { id: crypto.randomUUID(), name, team, guest: true }],
          },
    )
  },
  joinLeague(id: string, _team: string) {
    // All browser-local leagues already belong to this profile. Joining is idempotent.
    // Remote membership is handled separately by the authenticated backend contract.
    void _team
    return updateLeague(id, (league) => league)
  },
  startLeague(id: string) {
    return updateLeague(id, (l) =>
      l.status !== 'lobby' || l.ownerId !== l.userId || l.participants.length !== l.capacity
        ? l
        : {
            ...l,
            participants: shuffled(l.participants),
            status: 'live',
            remaining: l.timer,
          },
    )
  },
  pick(id: string, playerId: number, expected: number) {
    return updateLeague(id, (l) => commitPick(l, playerId, false, expected))
  },
  autoPick(id: string, expected: number) {
    return updateLeague(id, (l) => autoPick(l, expected))
  },
  tick(id: string, expected: number) {
    return updateLeague(id, (l) => {
      const previous = (l as League & { lastTickAt?: number }).lastTickAt ?? 0
      if (l.status !== 'live' || l.picks.length !== expected || Date.now() - previous < 950)
        return l
      return {
        ...(l.remaining <= 1 ? autoPick(l, expected) : { ...l, remaining: l.remaining - 1 }),
        lastTickAt: Date.now(),
      }
    })
  },
  toggleQueue(id: string, playerId: number) {
    return updateLeague(id, (l) =>
      l.picks.some((p) => p.playerId === playerId)
        ? l
        : {
            ...l,
            queue: l.queue.includes(playerId)
              ? l.queue.filter((p) => p !== playerId)
              : [...l.queue, playerId],
          },
    )
  },
  moveQueue(id: string, playerId: number, direction: number) {
    return updateLeague(id, (l) => {
      const queue = [...l.queue],
        index = queue.indexOf(playerId),
        next = index + direction
      if (index < 0 || next < 0 || next >= queue.length) return l
      ;[queue[index], queue[next]] = [queue[next], queue[index]]
      return { ...l, queue }
    })
  },
  setFpl(patch: Partial<FplSetup>) {
    return update((current) => ({ ...current, fpl: { ...current.fpl, ...patch }, savedPlan: null }))
  },
  savePlan() {
    return update((current) => ({
      ...current,
      savedPlan: { setup: structuredClone(current.fpl), savedAt: new Date().toISOString() },
    }))
  },
  profile(name: string, reducedMotion: boolean) {
    return update((current) => ({
      ...current,
      profile: { name, reducedMotion },
      leagues: current.leagues.map((l) => ({
        ...l,
        participants: l.participants.map((p) => (p.id === l.userId ? { ...p, name } : p)),
      })),
    }))
  },
  clearLeagues() {
    return update((current) => ({ ...current, leagues: [] }))
  },
  ensureDemo() {
    return update((current) =>
      current.leagues.some((l) => l.id === 'sunday')
        ? current
        : { ...current, leagues: [...current.leagues, initialState().leagues[0]] },
    )
  },
  restoreDemo() {
    return update((current) => ({ ...current, leagues: initialState().leagues }))
  },
}
