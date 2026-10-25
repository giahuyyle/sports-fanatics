import { candidates, players } from './data'
import type { FplSetup, League, SquadPlayer } from './types'

export function snakeIndex(pick: number, teams: number): number {
  if (!Number.isInteger(pick) || pick < 0 || !Number.isInteger(teams) || teams < 2)
    throw new Error('Invalid draft order')
  return Math.floor(pick / teams) % 2 === 0 ? pick % teams : teams - 1 - (pick % teams)
}
export const leaguePath = (league: League) =>
  `/nba/leagues/${league.id}/${league.status === 'live' ? 'draft' : league.status === 'complete' ? 'recap' : 'lobby'}`
export const currentParticipant = (league: League) =>
  league.participants[snakeIndex(league.picks.length, league.capacity)]
export function commitPick(
  league: League,
  playerId: number,
  automatic = false,
  expectedPick = league.picks.length,
): League {
  if (
    league.status !== 'live' ||
    league.picks.length !== expectedPick ||
    league.participants.length !== league.capacity ||
    !players.some((p) => p.id === playerId) ||
    league.picks.some((p) => p.playerId === playerId)
  )
    return league
  const participant = currentParticipant(league)
  if (!automatic && participant.id !== league.userId) return league
  const picks = [...league.picks, { playerId, participantId: participant.id, automatic }]
  return {
    ...league,
    picks,
    queue: league.queue.filter((id) => id !== playerId),
    remaining: league.timer,
    status: picks.length === league.capacity * league.rosterSize ? 'complete' : 'live',
  }
}
export function autoPick(league: League, expectedPick = league.picks.length): League {
  const available = players.filter(
    (player) => !league.picks.some((pick) => pick.playerId === player.id),
  )
  const queued =
    currentParticipant(league)?.id === league.userId
      ? league.queue.find((id) => available.some((player) => player.id === id))
      : undefined
  const id = queued ?? available[0]?.id
  return id === undefined ? league : commitPick(league, id, true, expectedPick)
}
export function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor((crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
export function validateSquad(squad: SquadPlayer[]): string | null {
  if (squad.length !== 15) return 'Your squad needs exactly 15 players.'
  if (squad.some((player) => !player.name.trim())) return 'Give every squad player a name.'
  if (new Set(squad.map((p) => p.name.trim().toLowerCase())).size !== 15)
    return 'Each squad player must have a different name.'
  if (new Set(squad.map((p) => p.id)).size !== 15) return 'Each squad player must have a unique ID.'
  for (const [position, count] of [
    ['GK', 2],
    ['DEF', 5],
    ['MID', 5],
    ['FWD', 3],
  ] as const) {
    if (squad.filter((p) => p.position === position).length !== count)
      return `Your squad needs ${count} ${position} players.`
  }
  return null
}
export function compareTransfer(setup: FplSetup) {
  const outgoing = setup.squad.find((p) => p.id === setup.outgoingId && p.position === 'MID')
  const candidate = candidates.find((p) => p.id === setup.candidateId)
  if (!outgoing || !candidate) throw new Error('Select a midfielder and replacement')
  const valid =
    Number.isFinite(setup.selling) &&
    Number.isFinite(setup.bank) &&
    setup.selling >= 0 &&
    setup.selling <= 20 &&
    setup.bank >= 0 &&
    setup.bank <= 100
  const penalty = 4 * Math.max(0, 1 + setup.other - setup.free)
  const keep = outgoing.points * setup.horizon
  const gross = candidate.points * setup.horizon
  const net = gross - penalty
  const gain = net - keep
  const inSquad = setup.squad.some(
    (p) => p.id === candidate.id || p.name.trim().toLowerCase() === candidate.name.toLowerCase(),
  )
  const affordable =
    valid && Math.round(candidate.price * 10) <= Math.round((setup.selling + setup.bank) * 10)
  return {
    outgoing,
    candidate,
    penalty,
    keep,
    gross,
    net,
    gain,
    affordable,
    valid,
    inSquad,
    recommend: affordable && !inSquad && gain > 1.5,
  }
}
