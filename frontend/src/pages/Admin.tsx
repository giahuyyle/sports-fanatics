import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { PageTitle } from '../components/ui'
import { adminAuth } from '../lib/firebase'
import { adminApi } from '../lib/admin-api'
import type { AdminPlayer, AuditRecord, ImportReport, Pool, Position } from '../lib/admin-api'
import '../styles/admin.css'

const positions: Position[] = ['PG', 'SG', 'SF', 'PF', 'C']
const season = new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0)
const emptyPlayer = () => ({
  name: '',
  rookie_season: season,
  no_appearances: false,
  archived: false,
  tier: 3,
  priority: 100,
  positions: ['PG'] as Position[],
  nba_team_id: null as string | null,
  external_ids: {} as Record<string, string>,
})
type PlayerForm = ReturnType<typeof emptyPlayer>

export default function Admin() {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [search, setSearch] = useState('')
  const [players, setPlayers] = useState<AdminPlayer[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState<PlayerForm>(emptyPlayer)
  const [pools, setPools] = useState<Pool[]>([])
  const [poolId, setPoolId] = useState('')
  const [poolName, setPoolName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [poolDirty, setPoolDirty] = useState(false)
  const [reports, setReports] = useState<ImportReport[]>([])
  const [audit, setAudit] = useState<AuditRecord[]>([])
  const [source, setSource] = useState('')
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (!adminAuth) return
    return onAuthStateChanged(adminAuth, (next) => {
      setUser(next)
      setAllowed(false)
      setReady(true)
      setPlayers([])
      setPools([])
      setReports([])
      setAudit([])
      setSelected([])
      setPoolId('')
      setForm(emptyPlayer())
      setEditing(null)
      setPassword('')
    })
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    adminApi<{ is_admin: boolean }>('/me')
      .then((me) => {
        if (active) setAllowed(me.is_admin)
      })
      .catch((e: Error) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!allowed) return
    let active = true
    Promise.all([
      adminApi<AdminPlayer[]>('/players?include_archived=true&limit=200'),
      adminApi<Pool[]>('/pools'),
      adminApi<ImportReport[]>('/admin/imports'),
      adminApi<AuditRecord[]>('/admin/audit'),
    ])
      .then(([p, pools, reports, audit]) => {
        if (active) {
          setPlayers(p)
          setPools(pools)
          setReports(reports)
          setAudit(audit)
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message)
      })
    return () => {
      active = false
    }
  }, [allowed])

  async function refresh() {
    const [p, poolRows, imports, auditRows] = await Promise.all([
      adminApi<AdminPlayer[]>(
        `/players?include_archived=true&limit=200&search=${encodeURIComponent(search)}`,
      ),
      adminApi<Pool[]>('/pools'),
      adminApi<ImportReport[]>('/admin/imports'),
      adminApi<AuditRecord[]>('/admin/audit'),
    ])
    setPlayers(p)
    setPools(poolRows)
    setReports(imports)
    setAudit(auditRows)
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }

  function edit(player: AdminPlayer) {
    setEditing(player.id)
    setForm({
      name: player.name,
      rookie_season: player.rookie_season,
      no_appearances: player.no_appearances,
      archived: player.archived,
      tier: player.tier,
      priority: player.priority,
      positions: player.positions,
      nba_team_id: player.nba_team_id,
      external_ids: player.external_ids,
    })
    document.getElementById('player-editor')?.scrollIntoView({ behavior: 'instant' })
    document.getElementById('player-name')?.focus()
  }

  async function savePlayer(e: FormEvent) {
    e.preventDefault()
    await run(async () => {
      await adminApi(
        editing ? `/admin/players/${editing}` : '/admin/players',
        editing ? 'PUT' : 'POST',
        form,
      )
      setEditing(null)
      setForm(emptyPlayer())
      await refresh()
      setMessage('Player saved.')
    })
  }

  const pool = pools.find((p) => p.id === poolId)
  return (
    <div className="admin-page">
      <PageTitle
        kicker="NBA ADMINISTRATION"
        title="Build the player pool"
        description="Manage player eligibility, career imports, and published draft pools."
      />
      {!adminAuth ? (
        <section className="panel">
          <h2>Firebase configuration required</h2>
          <p>
            Configure the Firebase environment variables documented in the backend setup guide to
            enable admin sign-in.
          </p>
        </section>
      ) : !ready ? (
        <p role="status">Checking sign-in…</p>
      ) : !user ? (
        <section className="panel admin-signin">
          <h2>Administrator sign-in</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run(async () => {
                await signInWithEmailAndPassword(adminAuth!, email, password)
              })
            }}
          >
            <label className="field-label">
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="field-label">
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="primary-button" disabled={busy}>
              Sign in
            </button>
          </form>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await signInWithPopup(adminAuth!, new GoogleAuthProvider())
              })
            }
          >
            Continue with Google
          </button>
        </section>
      ) : (
        <>
          <div className="admin-session">
            <p>Signed in as {user.email ?? user.uid}</p>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await signOut(adminAuth!)
                })
              }
            >
              Sign out
            </button>
          </div>
          {!allowed ? (
            <section className="panel">
              <h2>Administrator access required</h2>
              <p>Your account must be granted platform administrator access by the operator.</p>
            </section>
          ) : (
            <>
              <div className="admin-columns">
                <section className="panel" id="player-editor">
                  <h2>{editing ? 'Edit player' : 'Add player'}</h2>
                  <form onSubmit={savePlayer}>
                    <label className="field-label">
                      Player name
                      <input
                        id="player-name"
                        required
                        maxLength={120}
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </label>
                    <div className="admin-form-grid">
                      <label className="field-label">
                        Rookie season start year
                        <input
                          type="number"
                          min={1946}
                          max={season}
                          required
                          value={form.rookie_season}
                          onChange={(e) =>
                            setForm({ ...form, rookie_season: Number(e.target.value) })
                          }
                        />
                      </label>
                      <label className="field-label">
                        Tier
                        <select
                          value={form.tier}
                          onChange={(e) => setForm({ ...form, tier: Number(e.target.value) })}
                        >
                          {[1, 2, 3, 4, 5].map((t) => (
                            <option key={t} value={t}>
                              Tier {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        Automatic-pick priority
                        <input
                          type="number"
                          min={0}
                          required
                          value={form.priority}
                          onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                    <fieldset>
                      <legend>Eligible positions</legend>
                      <div className="admin-positions">
                        {positions.map((pos) => (
                          <label className="check-label" key={pos}>
                            <input
                              type="checkbox"
                              checked={form.positions.includes(pos)}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  positions: e.target.checked
                                    ? [...form.positions, pos]
                                    : form.positions.filter((p) => p !== pos),
                                })
                              }
                            />
                            {pos}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.no_appearances}
                        onChange={(e) => setForm({ ...form, no_appearances: e.target.checked })}
                      />
                      Current-season rookie with no NBA appearances
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={form.archived}
                        onChange={(e) => setForm({ ...form, archived: e.target.checked })}
                      />
                      Archived
                    </label>
                    <div className="action-row">
                      <button className="primary-button" disabled={busy || !form.positions.length}>
                        Save player
                      </button>
                      {editing && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setEditing(null)
                            setForm(emptyPlayer())
                          }}
                        >
                          Cancel edit
                        </button>
                      )}
                    </div>
                  </form>
                </section>
                <section className="panel">
                  <h2>Career statistics</h2>
                  <p>Import JSON or CSV season totals. Invalid files change no statistics.</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      void run(async () => {
                        if (!file) throw new Error('Choose an import file.')
                        if (file.size > 5_000_000)
                          throw new Error('Import files must be under 5 MB.')
                        try {
                          await adminApi('/admin/imports', 'POST', {
                            source,
                            format: file.name.toLowerCase().endsWith('.csv') ? 'csv' : 'json',
                            data: await file.text(),
                          })
                        } finally {
                          await refresh()
                        }
                        setMessage('Statistics imported.')
                      })
                    }}
                  >
                    <label className="field-label">
                      Data source
                      <input
                        required
                        maxLength={200}
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Import file
                      <input
                        type="file"
                        accept=".csv,.json"
                        required
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    <button className="primary-button" disabled={busy}>
                      Validate and import
                    </button>
                  </form>
                  <h3>Recent imports</h3>
                  <ul className="admin-records">
                    {reports.map((r) => (
                      <li key={r.id}>
                        <strong>{r.source}</strong> · {r.status} · {r.row_count} rows
                        {r.errors.length > 0 && (
                          <details>
                            <summary>Validation errors</summary>
                            <ul>
                              {r.errors.map((e, i) => (
                                <li key={i}>
                                  Row {e.row ?? 'file'}: {e.message}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
              <section className="panel">
                <h2>Player catalog</h2>
                <form
                  className="admin-search"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(refresh)
                  }}
                >
                  <label className="field-label">
                    Search players
                    <input value={search} onChange={(e) => setSearch(e.target.value)} />
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    Search
                  </button>
                </form>
                <p>
                  Select players across searches to configure a draft pool. {selected.length}{' '}
                  selected. Results show up to 200 players.
                </p>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Select</th>
                        <th>Player</th>
                        <th>Tier</th>
                        <th>Positions</th>
                        <th>History</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Select ${p.name}`}
                              checked={selected.includes(p.id)}
                              disabled={p.archived}
                              onChange={(e) => {
                                setPoolDirty(true)
                                setSelected(
                                  e.target.checked
                                    ? [...selected, p.id]
                                    : selected.filter((id) => id !== p.id),
                                )
                              }}
                            />
                          </td>
                          <td>
                            {p.name}
                            {p.archived && ' (archived)'}
                          </td>
                          <td>T{p.tier}</td>
                          <td>{p.positions.join(' / ')}</td>
                          <td>
                            {p.coverage.complete
                              ? p.coverage.no_appearances
                                ? 'No appearances yet'
                                : 'Complete'
                              : `Missing: ${p.coverage.missing_seasons.join(', ')}`}
                          </td>
                          <td>
                            <button className="secondary-button" onClick={() => edit(p)}>
                              Edit<span className="sr-only"> {p.name}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {players.length === 0 && <p>No players found. Add a player above.</p>}
              </section>
              <section className="panel">
                <h2>Versioned player pools</h2>
                <form
                  className="admin-search"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      const p = await adminApi<Pool>('/admin/pools', 'POST', { name: poolName })
                      await refresh()
                      setPoolId(p.id)
                      setPoolDirty(true)
                      setPoolName('')
                      setMessage('Draft pool created. Save selected players next.')
                    })
                  }}
                >
                  <label className="field-label">
                    New pool name
                    <input
                      required
                      maxLength={120}
                      value={poolName}
                      onChange={(e) => setPoolName(e.target.value)}
                    />
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    Create pool
                  </button>
                </form>
                <label className="field-label">
                  Pool version
                  <select
                    value={poolId}
                    onChange={(e) => {
                      const id = e.target.value
                      setPoolId(id)
                      setPoolDirty(false)
                      void run(async () => {
                        if (!id) {
                          setSelected([])
                          return
                        }
                        const data = await adminApi<{ players: { player_id: string }[] }>(
                          `/pools/${id}`,
                        )
                        setSelected(data.players.map((p) => p.player_id))
                      })
                    }}
                  >
                    <option value="">Choose a pool</option>
                    {pools.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.status}
                      </option>
                    ))}
                  </select>
                </label>
                <p>
                  Saving captures current tiers and positions. Publishing freezes them. Later edits
                  require a new pool version. Save the selection before publishing.
                </p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    disabled={busy || pool?.status !== 'draft' || !selected.length}
                    onClick={() =>
                      void run(async () => {
                        await adminApi(`/admin/pools/${poolId}/players`, 'PUT', {
                          player_ids: selected,
                        })
                        await refresh()
                        setPoolDirty(false)
                        setMessage('Pool selection saved. Ready for publication validation.')
                      })
                    }
                  >
                    Save selected players
                  </button>
                  <button
                    className="primary-button"
                    disabled={busy || pool?.status !== 'draft' || poolDirty || !selected.length}
                    onClick={() =>
                      void run(async () => {
                        await adminApi(`/admin/pools/${poolId}/publish`, 'POST')
                        await refresh()
                        setMessage('Player pool published. Eligibility is now frozen.')
                      })
                    }
                  >
                    Validate and publish pool
                  </button>
                </div>
              </section>
              <section className="panel">
                <h2>Recent admin changes</h2>
                <ul className="admin-records">
                  {audit.map((r) => (
                    <li key={r.id}>
                      <time>{new Date(r.created_at).toLocaleString()}</time> · {r.action} ·{' '}
                      <span>{r.target}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </>
      )}
      <div aria-live="polite">
        {busy && <p role="status">Working…</p>}
        {message && (
          <p className="success-note" role="status">
            {message}
          </p>
        )}
      </div>
      {error && (
        <p className="form-error admin-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
