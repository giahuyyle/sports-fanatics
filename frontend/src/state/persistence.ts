import { initialState, players } from './data'
import { snakeIndex, validateSquad } from './engine'
import type { AppState, FplSetup, League } from './types'

function validFpl(value: FplSetup): boolean {
  try {
    return (
      !!value &&
      Array.isArray(value.squad) &&
      !validateSquad(value.squad) &&
      value.squad.every((p) => Number.isFinite(p.points) && p.points >= 0) &&
      value.squad.some((p) => p.id === value.outgoingId && p.position === 'MID') &&
      ['mbeumo', 'bruno', 'gordon', 'rogers'].includes(value.candidateId) &&
      [value.selling, value.bank].every((n) => Number.isFinite(n) && n >= 0) &&
      [1, 2, 4, 6].includes(value.horizon) &&
      [value.free, value.other].every((n) => Number.isInteger(n) && n >= 0 && n <= 5)
    )
  } catch {
    return false
  }
}
function validLeague(l: League): boolean {
  try {
    return (
      typeof l.id === 'string' &&
      !!l.id &&
      typeof l.name === 'string' &&
      typeof l.code === 'string' &&
      [2, 4, 6].includes(l.capacity) &&
      [3, 4, 5].includes(l.rosterSize) &&
      [30, 45, 60, 90].includes(l.timer) &&
      ['lobby', 'live', 'complete'].includes(l.status) &&
      Array.isArray(l.participants) &&
      l.participants.length <= l.capacity &&
      (l.status === 'lobby' || l.participants.length === l.capacity) &&
      new Set(l.participants.map((p) => p.id)).size === l.participants.length &&
      l.participants.every(
        (p) =>
          typeof p.id === 'string' &&
          typeof p.name === 'string' &&
          typeof p.team === 'string' &&
          typeof p.guest === 'boolean',
      ) &&
      l.participants.some((p) => p.id === l.userId) &&
      l.participants.some((p) => p.id === l.ownerId) &&
      Array.isArray(l.picks) &&
      l.picks.length <= l.capacity * l.rosterSize &&
      (l.status !== 'lobby' || l.picks.length === 0) &&
      (l.status !== 'complete' || l.picks.length === l.capacity * l.rosterSize) &&
      new Set(l.picks.map((p) => p.playerId)).size === l.picks.length &&
      l.picks.every(
        (p, index) =>
          players.some((player) => player.id === p.playerId) &&
          typeof p.automatic === 'boolean' &&
          p.participantId === l.participants[snakeIndex(index, l.capacity)]?.id,
      )
    )
  } catch {
    return false
  }
}
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entry]) => [key, canonical(entry)]),
        )
      : value
export function recoverState(value: unknown): { state: AppState; recovered: boolean } {
  const base = initialState()
  if (!value || typeof value !== 'object' || (value as AppState).version !== 1)
    return { state: base, recovered: true }
  const saved = value as AppState
  const valid = Array.isArray(saved.leagues) ? saved.leagues.filter(validLeague) : []
  const seen = new Set<string>()
  const leagues = valid
    .filter((l) => {
      if (seen.has(l.id)) return false
      seen.add(l.id)
      return true
    })
    .map((l) => ({
      ...l,
      status: l.picks.length === l.capacity * l.rosterSize ? ('complete' as const) : l.status,
      remaining: Number.isFinite(l.remaining)
        ? Math.min(l.timer, Math.max(0, l.remaining))
        : l.timer,
      queue: Array.isArray(l.queue)
        ? [...new Set(l.queue)].filter(
            (id) => players.some((p) => p.id === id) && !l.picks.some((p) => p.playerId === id),
          )
        : [],
    }))
  const profile =
    typeof saved.profile?.name === 'string' &&
    saved.profile.name.trim() &&
    typeof saved.profile.reducedMotion === 'boolean'
      ? saved.profile
      : base.profile
  const fpl = validFpl(saved.fpl) ? saved.fpl : base.fpl
  const savedPlan =
    saved.savedPlan &&
    validFpl(saved.savedPlan.setup) &&
    Number.isFinite(Date.parse(saved.savedPlan.savedAt))
      ? saved.savedPlan
      : null
  const state: AppState = { version: 1, profile, leagues, fpl, savedPlan }
  return { state, recovered: JSON.stringify(canonical(state)) !== JSON.stringify(canonical(saved)) }
}
