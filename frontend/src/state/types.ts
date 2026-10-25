export interface Player {
  id: number
  /** Official NBA ID when a legacy local demo ID is retained. */
  nbaId?: number
  name: string
  team: string
  position: string
  rank: number
  points: number
  rebounds: number
  assists: number
  image: boolean
}
export interface Participant {
  id: string
  name: string
  team: string
  guest: boolean
}
export interface Pick {
  playerId: number
  participantId: string
  automatic: boolean
}
export interface League {
  id: string
  name: string
  code: string
  capacity: number
  rosterSize: number
  timer: number
  participants: Participant[]
  ownerId: string
  userId: string
  status: 'lobby' | 'live' | 'complete'
  picks: Pick[]
  queue: number[]
  remaining: number
}
export interface SquadPlayer {
  id: string
  name: string
  position: 'GK' | 'DEF' | 'MID' | 'FWD'
  points: number
}
export interface FplSetup {
  squad: SquadPlayer[]
  outgoingId: string
  candidateId: string
  selling: number
  bank: number
  free: number
  other: number
  horizon: number
}
export interface AppState {
  version: 1
  profile: { name: string; reducedMotion: boolean }
  leagues: League[]
  fpl: FplSetup
  savedPlan: { setup: FplSetup; savedAt: string } | null
}
