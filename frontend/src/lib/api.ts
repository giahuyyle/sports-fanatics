const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export async function getHealth(signal?: AbortSignal): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/api/health`, { signal })
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  const data: unknown = await response.json()
  if (
    typeof data !== 'object' || data === null ||
    !('status' in data) || typeof data.status !== 'string'
  ) {
    throw new Error('Invalid health response')
  }
  return { status: data.status }
}
