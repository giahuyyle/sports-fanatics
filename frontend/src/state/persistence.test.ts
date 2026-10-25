import { describe, expect, it } from 'vitest'
import { initialState } from './data'
import { recoverState } from './persistence'
import { autoPick } from './engine'

describe('saved state recovery', () => {
  it('accepts valid state regardless of object key order', () => {
    const state = initialState()
    expect(recoverState(state)).toEqual({ state, recovered: false })
  })
  it('recovers a damaged hidden FPL slice without replacing NBA leagues', () => {
    const state = initialState()
    state.leagues[0].name = 'Keep my league'
    state.fpl.squad.pop()
    const result = recoverState(state)
    expect(result.recovered).toBe(true)
    expect(result.state.leagues[0].name).toBe('Keep my league')
    expect(result.state.fpl.squad).toHaveLength(15)
  })
  it('does not drop a valid league when another league is damaged', () => {
    const state = initialState()
    state.leagues[1].participants[1].id = 'you'
    expect(recoverState(state).state.leagues.map((l) => l.id)).toEqual(['sunday'])
  })
  it('repairs completed drafts that were incorrectly saved as live', () => {
    const state = initialState()
    while (state.leagues[0].status !== 'complete') state.leagues[0] = autoPick(state.leagues[0])
    state.leagues[0].status = 'live'
    expect(recoverState(state).state.leagues[0].status).toBe('complete')
  })
  it('removes stale and duplicate queue entries without resetting picks', () => {
    const state = initialState()
    state.leagues[0].queue = [203999, 201939, 201939, -1]
    const result = recoverState(state)
    expect(result.state.leagues[0].queue).toEqual([201939])
    expect(result.state.leagues[0].picks).toHaveLength(3)
  })
})
