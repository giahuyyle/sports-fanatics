import { useSyncExternalStore } from 'react'
import { initialState, players } from './data'
import { autoPick, commitPick, shuffled, validateSquad } from './engine'
import type { AppState, FplSetup, League } from './types'

export const STORAGE_KEY = 'sports-fanatics:v1'
const listeners = new Set<() => void>()
let storageWarning = ''
function validState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false
  const s = value as AppState
  if (s.version !== 1 || typeof s.profile?.name !== 'string' || typeof s.profile.reducedMotion !== 'boolean' || !Array.isArray(s.leagues)) return false
  if (!s.fpl || !Array.isArray(s.fpl.squad) || validateSquad(s.fpl.squad)) return false
  if (!s.fpl.squad.some((p) => p.id === s.fpl.outgoingId && p.position === 'MID')) return false
  if (!['mbeumo', 'bruno', 'gordon', 'rogers'].includes(s.fpl.candidateId)) return false
  if (![s.fpl.selling, s.fpl.bank].every((n) => Number.isFinite(n) && n >= 0) || ![1, 2, 4, 6].includes(s.fpl.horizon)) return false
  if (![s.fpl.free, s.fpl.other].every((n) => Number.isInteger(n) && n >= 0 && n <= 5)) return false
  return s.leagues.every((league) => {
    if (!league || typeof league.id !== 'string' || typeof league.name !== 'string' || typeof league.code !== 'string' ||
      ![2, 4, 6].includes(league.capacity) || ![3, 4, 5].includes(league.rosterSize) || ![30, 45, 60, 90].includes(league.timer) ||
      !['lobby', 'live', 'complete'].includes(league.status) || !Number.isFinite(league.remaining) || league.remaining < 0 ||
      !Array.isArray(league.picks) || !Array.isArray(league.queue) || !Array.isArray(league.participants)) return false
    if (league.participants.length > league.capacity || !league.participants.some((p) => p.id === league.userId) || !league.participants.some((p) => p.id === league.ownerId)) return false
    if (!league.participants.every((p) => typeof p.id === 'string' && typeof p.name === 'string' && typeof p.team === 'string' && typeof p.guest === 'boolean')) return false
    if (league.status !== 'lobby' && league.participants.length !== league.capacity) return false
    if (league.picks.length > league.capacity * league.rosterSize || (league.status === 'complete' && league.picks.length !== league.capacity * league.rosterSize)) return false
    if (new Set(league.picks.map((p) => p.playerId)).size !== league.picks.length) return false
    return league.picks.every((p) => players.some((player) => player.id === p.playerId) && league.participants.some((person) => person.id === p.participantId)) && league.queue.every((id) => players.some((p) => p.id === id))
  })
}
function readState(): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (validState(parsed)) return parsed
      storageWarning = 'Saved demo data could not be read. Sample data has been restored.'
    }
  } catch { storageWarning = 'Browser storage is unavailable. Changes will last for this visit only.' }
  return initialState()
}
let state = readState()
function update(next: AppState) {
  state = next
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) }
  catch { storageWarning = 'Browser storage is unavailable. Changes will last for this visit only.' }
  listeners.forEach((listener) => listener())
}
function updateLeague(id: string, transform: (league: League) => League) {
  const leagues = state.leagues.map((league) => league.id === id ? transform(league) : league)
  update({ ...state, leagues })
}
export function useStore() {
  return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, () => state)
}
export const getStorageWarning = () => storageWarning
export const actions = {
  addLeague(league: League) { update({ ...state, leagues: [...state.leagues, league] }) },
  addGuest(id: string, name: string, team: string) {
    updateLeague(id, (l) => l.status !== 'lobby' || l.ownerId !== l.userId || l.participants.length >= l.capacity ? l : {
      ...l, participants: [...l.participants, { id: crypto.randomUUID(), name, team, guest: true }],
    })
  },
  joinLeague(id: string, team: string) {
    updateLeague(id, (l) => l.status !== 'lobby' || l.participants.length >= l.capacity ? l : {
      ...l, userId: 'you', participants: [...l.participants.map((p) => ({ ...p, id: p.id === 'you' ? `host-${l.id}` : p.id, guest: true })), { id: 'you', name: state.profile.name, team, guest: false }],
      ownerId: l.ownerId === 'you' ? `host-${l.id}` : l.ownerId,
    })
  },
  startLeague(id: string) {
    updateLeague(id, (l) => l.status !== 'lobby' || l.ownerId !== l.userId || l.participants.length !== l.capacity ? l : {
      ...l, participants: shuffled(l.participants), status: 'live', remaining: l.timer,
    })
  },
  pick(id: string, playerId: number, expected: number) { updateLeague(id, (l) => commitPick(l, playerId, false, expected)) },
  autoPick(id: string, expected: number) { updateLeague(id, (l) => autoPick(l, expected)) },
  tick(id: string, expected: number) {
    updateLeague(id, (l) => l.status !== 'live' || l.picks.length !== expected ? l : l.remaining <= 1 ? autoPick(l, expected) : { ...l, remaining: l.remaining - 1 })
  },
  toggleQueue(id: string, playerId: number) {
    updateLeague(id, (l) => l.picks.some((p) => p.playerId === playerId) ? l : { ...l, queue: l.queue.includes(playerId) ? l.queue.filter((p) => p !== playerId) : [...l.queue, playerId] })
  },
  moveQueue(id: string, playerId: number, direction: number) {
    updateLeague(id, (l) => {
      const queue = [...l.queue], index = queue.indexOf(playerId), next = index + direction
      if (index < 0 || next < 0 || next >= queue.length) return l
      ;[queue[index], queue[next]] = [queue[next], queue[index]]
      return { ...l, queue }
    })
  },
  setFpl(patch: Partial<FplSetup>) { update({ ...state, fpl: { ...state.fpl, ...patch }, savedPlan: null }) },
  savePlan() { update({ ...state, savedPlan: { setup: structuredClone(state.fpl), savedAt: new Date().toISOString() } }) },
  profile(name: string, reducedMotion: boolean) {
    update({ ...state, profile: { name, reducedMotion }, leagues: state.leagues.map((l) => ({ ...l, participants: l.participants.map((p) => p.id === l.userId ? { ...p, name } : p) })) })
  },
  clearLeagues() { update({ ...state, leagues: [] }) },
  restoreDemo() { update({ ...state, leagues: initialState().leagues }) },
}
