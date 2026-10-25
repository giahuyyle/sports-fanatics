import { useEffect, useState } from 'react'
import { adminApi } from '../lib/admin-api'
import type { AdminPlayer } from '../lib/admin-api'
export function SelectionReview({
  ids,
  known,
  disabled,
  onRemove,
}: {
  ids: string[]
  known: AdminPlayer[]
  disabled: boolean
  onRemove: (id: string) => void
}) {
  const [requestedPage, setPage] = useState(0)
  const [names, setNames] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  const page = Math.min(requestedPage, Math.max(0, Math.ceil(ids.length / 20) - 1))
  const shown = ids.slice(page * 20, page * 20 + 20)
  const key = shown.join(',')
  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    for (const id of key.split(',').filter(Boolean)) {
      adminApi<AdminPlayer>(`/players/${id}`, 'GET', undefined, controller.signal)
        .then((p) => {
          if (!controller.signal.aborted) setNames((cache) => ({ ...cache, [id]: p.name }))
        })
        .catch(() => {
          /* The selectable ID remains available when details cannot load. */
        })
    }
    return () => controller.abort()
  }, [key, open])
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Review {ids.length} selected players</summary>
      {shown.length === 0 ? (
        <p>No players selected.</p>
      ) : (
        <ul className="admin-records">
          {shown.map((id) => (
            <li key={id}>
              <span>{known.find((p) => p.id === id)?.name ?? names[id] ?? id}</span>{' '}
              <button
                type="button"
                className="secondary-button"
                disabled={disabled}
                onClick={() => onRemove(id)}
              >
                Remove
                <span className="sr-only">
                  {' '}
                  {known.find((p) => p.id === id)?.name ?? names[id] ?? id}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="action-row">
        <button
          type="button"
          className="secondary-button"
          disabled={page === 0}
          onClick={() => setPage(page - 1)}
        >
          Previous selected
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={(page + 1) * 20 >= ids.length}
          onClick={() => setPage(page + 1)}
        >
          Next selected
        </button>
      </div>
    </details>
  )
}
