import { adminAuth } from './firebase'

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export async function adminApi<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const user = adminAuth?.currentUser
  if (!user) throw new Error('Sign in to continue.')
  const token = await user.getIdToken()
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const result = await response.json()
  if (!response.ok) {
    const details = result.error?.details
    throw new Error(
      `${result.error?.message ?? 'Request failed.'}${details ? ` ${JSON.stringify(details)}` : ''}`,
    )
  }
  return result as T
}

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C'
export interface AdminPlayer {
  id: string
  name: string
  rookie_season: number
  no_appearances: boolean
  archived: boolean
  tier: number
  priority: number
  positions: Position[]
  nba_team_id: string | null
  external_ids: Record<string, string>
  coverage: { complete: boolean; missing_seasons: number[]; no_appearances: boolean }
}
export interface Pool {
  id: string
  name: string
  status: 'draft' | 'published'
}
export interface ImportReport {
  id: string
  source: string
  status: string
  row_count: number
  errors: { row: number | null; message: string }[]
}
export interface AuditRecord {
  id: string
  action: string
  target: string
  created_at: string
}

export interface AdminPlayerPage {
  items: AdminPlayer[]
  total: number
  offset: number
  limit: number
}
