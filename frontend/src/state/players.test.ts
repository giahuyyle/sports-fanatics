import { describe, expect, it } from 'vitest'
import { players, playerById } from './data'

// Duplicate identities previously caused Mikal's team and portrait to resolve to Shai.
describe('NBA player identities', () => {
  it('keeps both local and official NBA identities unique', () => {
    expect(new Set(players.map((p) => p.id)).size).toBe(players.length)
    expect(new Set(players.map((p) => p.nbaId ?? p.id)).size).toBe(players.length)
    expect(playerById(1628983).name).toBe('Shai Gilgeous-Alexander')
    expect(playerById(1628969).name).toBe('Mikal Bridges')
  })
})
