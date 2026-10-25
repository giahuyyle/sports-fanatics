import { useEffect, useState } from 'react'
import { adminApi } from '../lib/admin-api'
import { Modal } from './ui'

type SeasonRow = {
  season: number
  phase: string
  scope: string
  totals: Record<string, number>
  averages: Record<string, number | null>
}
export function AdminHistory({
  id,
  name,
  onClose,
}: {
  id: string
  name: string
  onClose: () => void
}) {
  const [data, setData] = useState<SeasonRow[] | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    adminApi<{ seasons: SeasonRow[] }>(
      `/players/${id}/history`,
      'GET',
      undefined,
      controller.signal,
    )
      .then((result) => setData(result.seasons))
      .catch((e: Error) => {
        if (!controller.signal.aborted) setError(e.message)
      })
    return () => controller.abort()
  }, [id, retry])
  return (
    <Modal title={`${name} · career history`} onClose={onClose}>
      <p>
        Player ID: <code className="selectable-id">{id}</code>
      </p>
      <p>
        Season years name the starting calendar year. TOTAL is the season summary; team splits are
        separate and must not be added to TOTAL.
      </p>
      {error ? (
        <p role="alert">
          {error}
          <button
            className="secondary-button"
            onClick={() => {
              setError('')
              setRetry(retry + 1)
            }}
          >
            Retry history
          </button>
        </p>
      ) : !data ? (
        <p role="status">Loading history…</p>
      ) : data.length === 0 ? (
        <p>No season totals have been imported for this player.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <caption>Imported season totals</caption>
            <thead>
              <tr>
                <th>Season</th>
                <th>Phase / scope</th>
                <th>Games</th>
                <th>PTS / game</th>
                <th>REB / game</th>
                <th>AST / game</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, index) => (
                <tr key={index}>
                  <th scope="row">
                    {row.season}/{String(row.season + 1).slice(-2)}
                  </th>
                  <td>
                    {row.phase} · {row.scope}
                  </td>
                  <td>{row.totals.games}</td>
                  {['points', 'rebounds', 'assists'].map((stat) => (
                    <td key={stat}>{row.averages[stat]?.toFixed(1) ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button className="secondary-button" onClick={() => downloadImportTemplate(id)}>
        Download import template
      </button>
    </Modal>
  )
}

import { downloadImportTemplate } from '../lib/import-template'
