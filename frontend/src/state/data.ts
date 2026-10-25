import playerData from './players.json'
import type { AppState, Player, SquadPlayer } from './types'

export const players: Player[] = playerData
export const playerById = (id: number) => players.find((player) => player.id === id)!
export const initials = (name: string) => name.split(/[\s-]+/).filter(Boolean).map((word) => word[0]).slice(0, 2).join('').toUpperCase()
export const candidates = [
  { id: 'mbeumo', name: 'Bryan Mbeumo', short: 'Mbeumo', team: 'BRE', price: 7.5, points: 5.4, risk: 'Low', fixtures: ['LEI (H)', 'SOU (A)', 'WHU (H)', 'AVL (A)', 'FUL (H)', 'EVE (A)'] },
  { id: 'bruno', name: 'Bruno Fernandes', short: 'Fernandes', team: 'MUN', price: 8.5, points: 5.7, risk: 'Low', fixtures: ['EVE (H)', 'IPS (A)', 'ARS (A)', 'NFO (H)', 'MCI (A)', 'BOU (H)'] },
  { id: 'gordon', name: 'Anthony Gordon', short: 'Gordon', team: 'NEW', price: 7.4, points: 4.8, risk: 'Medium', fixtures: ['WHU (H)', 'CRY (A)', 'LIV (H)', 'BRE (A)', 'LEI (H)', 'IPS (A)'] },
  { id: 'rogers', name: 'Morgan Rogers', short: 'Rogers', team: 'AVL', price: 5.5, points: 4.2, risk: 'Medium', fixtures: ['CRY (H)', 'CHE (A)', 'BRE (H)', 'SOU (H)', 'NFO (A)', 'MCI (H)'] },
]
export const sampleSquad: SquadPlayer[] = [
  { id: 'raya', name: 'Raya', position: 'GK', points: 4.1 },
  { id: 'fabianski', name: 'Fabiański', position: 'GK', points: 2.8 },
  { id: 'gabriel', name: 'Gabriel', position: 'DEF', points: 4.8 },
  { id: 'saliba', name: 'Saliba', position: 'DEF', points: 4.4 },
  { id: 'trent', name: 'Alexander-Arnold', position: 'DEF', points: 4.9 },
  { id: 'aina', name: 'Aina', position: 'DEF', points: 3.5 },
  { id: 'hall', name: 'Hall', position: 'DEF', points: 3.2 },
  { id: 'salah', name: 'Salah', position: 'MID', points: 7.9 },
  { id: 'palmer', name: 'Palmer', position: 'MID', points: 6.3 },
  { id: 'eze', name: 'Eberechi Eze', position: 'MID', points: 4.1 },
  { id: 'saka', name: 'Saka', position: 'MID', points: 6.1 },
  { id: 'rogers', name: 'Morgan Rogers', position: 'MID', points: 4.2 },
  { id: 'haaland', name: 'Haaland', position: 'FWD', points: 6.5 },
  { id: 'isak', name: 'Isak', position: 'FWD', points: 5.6 },
  { id: 'wood', name: 'Wood', position: 'FWD', points: 4.4 },
]
export function initialState(): AppState {
  return {
    version: 1, profile: { name: 'Sam Taylor', reducedMotion: false }, savedPlan: null,
    fpl: { squad: sampleSquad, outgoingId: 'eze', candidateId: 'mbeumo', selling: 7, bank: 1.5, free: 1, other: 0, horizon: 4 },
    leagues: [
      {
        id: 'sunday', name: 'The Sunday League', code: 'SUNDAY', capacity: 4, rosterSize: 5, timer: 60,
        ownerId: 'maya', userId: 'you', status: 'live', remaining: 60, queue: [],
        participants: [
          { id: 'maya', name: 'Maya Chen', team: 'Buckets & Chill', guest: true },
          { id: 'alex', name: 'Alex Rivera', team: 'The Bench Mob', guest: true },
          { id: 'jordan', name: 'Jordan Lee', team: 'No Easy Buckets', guest: true },
          { id: 'you', name: 'Sam Taylor', team: 'Court Vision', guest: false },
        ],
        picks: [
          { playerId: 203999, participantId: 'maya', automatic: false },
          { playerId: 1629029, participantId: 'alex', automatic: false },
          { playerId: 203507, participantId: 'jordan', automatic: false },
        ],
      },
      {
        id: 'office', name: 'Office Hoops', code: 'OFFICE', capacity: 4, rosterSize: 4, timer: 45,
        ownerId: 'you', userId: 'you', status: 'lobby', remaining: 45, queue: [], picks: [],
        participants: [
          { id: 'you', name: 'Sam Taylor', team: 'Court Vision', guest: false },
          { id: 'maya', name: 'Maya Chen', team: 'Buckets & Chill', guest: true },
        ],
      },
    ],
  }
}
