import { adminAuth } from './firebase'

const base = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public code = 'request_failed',
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export async function adminApi<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const user = adminAuth?.currentUser
  if (!user) throw new ApiError('Sign in to continue.', 401, 'authentication_required')
  const token = await user.getIdToken()
  let response: Response
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      method,
      signal: signal ?? AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(
      'The service could not be reached. Check your connection and retry. If you were saving, refresh to check whether it completed.',
      0,
      'connection_failed',
    )
  }
  const text = await response.text()
  let result
  try {
    result = text ? JSON.parse(text) : null
  } catch {
    throw new ApiError(
      `The service returned an unreadable response (${response.status}). Refresh to check the latest state before retrying a save.`,
      response.status,
      'invalid_response',
    )
  }
  if (!response.ok) {
    const error = result?.error
    throw new ApiError(
      error?.message ?? `Request failed (${response.status}). Please retry.`,
      response.status,
      error?.code,
      error?.details,
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
