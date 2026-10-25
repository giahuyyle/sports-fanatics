import { describe, expect, it } from 'vitest'
import { initialState } from './data'
import { autoPick, commitPick, compareTransfer, snakeIndex, validateSquad } from './engine'

describe('snake draft', () => {
  it('reverses every round, including consecutive endpoint picks', () => {
    expect(Array.from({ length: 12 }, (_, i) => snakeIndex(i, 4))).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3])
  })
  it('rejects duplicate, unknown, and stale picks', () => {
    const league = initialState().leagues[0]
    expect(commitPick(league, 203999)).toBe(league)
    expect(commitPick(league, -1)).toBe(league)
    expect(commitPick(league, 1628983, false, 2)).toBe(league)
  })
  it('updates picks, queue, and timer together', () => {
    const league = { ...initialState().leagues[0], queue: [1628983, 201939], remaining: 5 }
    const next = commitPick(league, 1628983)
    expect(next.picks.at(-1)?.participantId).toBe('you')
    expect(next.queue).toEqual([201939])
    expect(next.remaining).toBe(60)
    expect(snakeIndex(next.picks.length, 4)).toBe(3)
  })
  it('uses first available queued player at timeout', () => {
    const league = { ...initialState().leagues[0], queue: [203999, 201939, 1628983] }
    expect(autoPick(league).picks.at(-1)).toEqual({ playerId: 201939, participantId: 'you', automatic: true })
  })
  it('blocks manual picks on another manager’s turn', () => {
    const league = commitPick(commitPick(initialState().leagues[0], 1628983), 201939)
    expect(commitPick(league, 1630162)).toBe(league)
  })
  it('completes six-team draft with full unique rosters', () => {
    let league = initialState().leagues[0]
    league = { ...league, capacity: 6, rosterSize: 5, picks: [], participants: [...league.participants, { id: 'a', name: 'A', team: 'A', guest: true }, { id: 'b', name: 'B', team: 'B', guest: true }] }
    for (let i = 0; i < 30; i++) league = autoPick(league)
    expect(league.status).toBe('complete')
    expect(new Set(league.picks.map((p) => p.playerId)).size).toBe(30)
    for (const person of league.participants) expect(league.picks.filter((p) => p.participantId === person.id)).toHaveLength(5)
    expect(autoPick(league)).toBe(league)
  })
})
describe('FPL comparison', () => {
  it('compares keep against net transfer points', () => {
    const result = compareTransfer(initialState().fpl)
    expect(result.keep).toBeCloseTo(16.4)
    expect(result.gain).toBeCloseTo(5.2)
    expect(result.recommend).toBe(true)
  })
  it('includes penalties for all planned transfers', () => {
    const result = compareTransfer({ ...initialState().fpl, other: 2, free: 1 })
    expect(result.penalty).toBe(8)
    expect(result.recommend).toBe(false)
  })
  it('rejects unaffordable and owned replacements', () => {
    expect(compareTransfer({ ...initialState().fpl, bank: 0, selling: 1 }).recommend).toBe(false)
    expect(compareTransfer({ ...initialState().fpl, candidateId: 'rogers' }).inSquad).toBe(true)
  })
  it('validates squad size and duplicate names', () => {
    const { squad } = initialState().fpl
    expect(validateSquad(squad)).toBeNull()
    expect(validateSquad(squad.slice(1))).toBeTruthy()
    expect(validateSquad(squad.map((p) => ({ ...p, name: 'Same' })))).toBeTruthy()
  })
})
