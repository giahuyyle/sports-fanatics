import { useEffect, useRef, useState } from 'react'
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
import { AdminHistory } from '../components/AdminHistory'
import { downloadImportTemplate } from '../lib/import-template'
import { SelectionReview } from '../components/SelectionReview'
import { useNavigationGuard } from '../state/router'
import { adminAuth } from '../lib/firebase'
import { adminApi } from '../lib/admin-api'
import type {
  AdminPlayer,
  AdminPlayerPage,
  AuditRecord,
  ImportReport,
  Pool,
  Position,
} from '../lib/admin-api'
import '../styles/admin.css'

const PAGE_SIZE = 50
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
  const [appliedSearch, setAppliedSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
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
  const busyRef = useRef(false)
  const [permission, setPermission] = useState<'checking' | 'allowed' | 'denied' | 'error'>(
    'checking',
  )
  const [authAttempt, setAuthAttempt] = useState(0)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [readErrors, setReadErrors] = useState<Record<string, string>>({})
  const [teams, setTeams] = useState<{ id: string; code: string; name: string }[]>([])
  const [providerJson, setProviderJson] = useState('{}')
  const [editorDirty, setEditorDirty] = useState(false)
  const [history, setHistory] = useState<{ id: string; name: string } | null>(null)
  const [poolLoaded, setPoolLoaded] = useState(false)
  useNavigationGuard(poolDirty || editorDirty || busy)

  useEffect(() => {
    if (!adminAuth) return
    return onAuthStateChanged(adminAuth, (next) => {
      setUser(next)
      setAllowed(false)
      setPermission('checking')
      setReadErrors({})
      setEditorDirty(false)
      setPoolDirty(false)
      setPoolLoaded(false)
      setProviderJson('{}')
      setReady(true)
      setPlayers([])
      setOffset(0)
      setTotal(0)
      setSearch('')
      setAppliedSearch('')
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
        if (active) {
          setAllowed(me.is_admin)
          setPermission(me.is_admin ? 'allowed' : 'denied')
        }
      })
      .catch((e: Error) => {
        if (active) {
          setError(e.message)
          setPermission('error')
        }
      })
    return () => {
      active = false
    }
  }, [user, authAttempt])

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) return refresh(0, '', controller.signal)
    })
    return () => controller.abort()
    // The initial load is scoped to the authorized session, not pagination edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed])

  async function refresh(nextOffset = offset, query = appliedSearch, signal?: AbortSignal) {
    setReadErrors({})
    setCatalogLoading(true)
    const load = async <T,>(name: string, path: string, apply: (value: T) => void) => {
      try {
        const value = await adminApi<T>(path, 'GET', undefined, signal)
        if (!signal?.aborted) apply(value)
      } catch (e) {
        if (!signal?.aborted)
          setReadErrors((errors) => ({
            ...errors,
            [name]: e instanceof Error ? e.message : 'Unable to load this panel.',
          }))
      } finally {
        if (name === 'Player catalog' && !signal?.aborted) setCatalogLoading(false)
      }
    }
    await Promise.all([
      load<AdminPlayerPage>(
        'Player catalog',
        `/admin/players?limit=${PAGE_SIZE}&offset=${nextOffset}&search=${encodeURIComponent(query)}`,
        (p) => {
          if (!Array.isArray(p.items)) throw new Error('Unexpected catalog response. Please retry.')
          setPlayers(p.items)
          setOffset(p.offset)
          setTotal(p.total)
          setAppliedSearch(query)
        },
      ),
      load<Pool[]>('Pools', '/pools', setPools),
      load<ImportReport[]>('Imports', '/admin/imports', setReports),
      load<AuditRecord[]>('Audit history', '/admin/audit', setAudit),
      load<typeof teams>('NBA teams', '/nba-teams', setTeams),
    ])
  }

  async function run(action: () => Promise<void>) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  function edit(player: AdminPlayer) {
    if (busyRef.current || (editorDirty && !window.confirm('Discard unsaved player changes?')))
      return
    setEditorDirty(false)
    setProviderJson(JSON.stringify(player.external_ids, null, 2))
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
    let ids: unknown
    try {
      ids = JSON.parse(providerJson)
      if (
        !ids ||
        typeof ids !== 'object' ||
        Array.isArray(ids) ||
        !Object.entries(ids).every(
          ([key, value]) => key.trim() && typeof value === 'string' && value.trim(),
        )
      )
        throw new Error()
    } catch {
      setError('Provider IDs must be a JSON object of nonempty provider names and ID strings.')
      return
    }
    await run(async () => {
      await adminApi(
        editing ? `/admin/players/${editing}` : '/admin/players',
        editing ? 'PUT' : 'POST',
        { ...form, external_ids: ids },
      )
      setEditing(null)
      setForm(emptyPlayer())
      setProviderJson('{}')
      setEditorDirty(false)
      setMessage('Player saved.')
      await refresh()
    })
  }

  async function selectPool(id: string) {
    if (busyRef.current || (poolDirty && !window.confirm('Discard unsaved pool selections?')))
      return
    await run(async () => {
      const data = id
        ? await adminApi<{ players: { player_id: string }[] }>(`/pools/${id}`)
        : { players: [] }
      setPoolId(id)
      setSelected(data.players.map((p) => p.player_id))
      setPoolDirty(false)
      setPoolLoaded(!!id)
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
              <h2>
                {permission === 'checking'
                  ? 'Checking administrator access…'
                  : permission === 'error'
                    ? 'Unable to check administrator access'
                    : 'Administrator access required'}
              </h2>
              <p>
                {permission === 'checking'
                  ? 'Please wait while your permissions are verified.'
                  : permission === 'error'
                    ? 'The permission check failed. Your account has not been classified as denied.'
                    : 'Your account must be granted platform administrator access by the operator.'}
              </p>
              {permission === 'error' && (
                <button
                  className="secondary-button"
                  onClick={() => {
                    setPermission('checking')
                    setError('')
                    setAuthAttempt(authAttempt + 1)
                  }}
                >
                  Retry access check
                </button>
              )}
            </section>
          ) : (
            <>
              {Object.keys(readErrors).length > 0 && (
                <section className="panel" aria-label="Panel refresh issues">
                  <h2>Some panels could not refresh</h2>
                  <ul>
                    {Object.entries(readErrors).map(([panel, text]) => (
                      <li key={panel}>
                        {panel}: {text}
                      </li>
                    ))}
                  </ul>
                  <p>
                    Previously loaded data is retained. Completed saves are not undone by a refresh
                    failure.
                  </p>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void run(refresh)}
                  >
                    Retry loading panels
                  </button>
                </section>
              )}
              <div className="admin-columns">
                <section className="panel" id="player-editor">
                  <h2>{editing ? 'Edit player' : 'Add player'}</h2>
                  <form onSubmit={savePlayer} onChange={() => setEditorDirty(true)}>
                    <fieldset disabled={busy || catalogLoading} className="admin-form-fields">
                      <legend className="sr-only">Player details</legend>
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
                      <label className="field-label">
                        NBA team
                        <select
                          value={form.nba_team_id ?? ''}
                          onChange={(e) =>
                            setForm({ ...form, nba_team_id: e.target.value || null })
                          }
                        >
                          <option value="">Unassigned / free agent</option>
                          {teams.map((team) => (
                            <option key={team.id} value={team.id}>
                              {team.code} · {team.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field-label">
                        Provider IDs (JSON)
                        <textarea
                          rows={3}
                          spellCheck={false}
                          value={providerJson}
                          onChange={(e) => setProviderJson(e.target.value)}
                          aria-describedby="provider-help"
                        />
                      </label>
                      <p id="provider-help" className="draft-help">
                        Use provider names and string IDs, for example {`{"nba": "203999"}`}.
                      </p>
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
                        <button
                          className="primary-button"
                          disabled={busy || !form.positions.length}
                        >
                          Save player
                        </button>
                        {editing && (
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              if (editorDirty && !window.confirm('Discard unsaved player changes?'))
                                return
                              setEditing(null)
                              setEditorDirty(false)
                              setProviderJson('{}')
                              setForm(emptyPlayer())
                            }}
                          >
                            Cancel edit
                          </button>
                        )}
                      </div>
                    </fieldset>
                  </form>
                </section>
                <section className="panel">
                  <h2>Career statistics</h2>
                  <p>
                    Import JSON or CSV season totals. Invalid files change no statistics. Season
                    years name the starting year; scope TOTAL is the season summary. Explicit
                    zero-game rows describe seasons without appearances.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={() => downloadImportTemplate(editing ?? undefined)}
                  >
                    Download JSON import template
                  </button>
                  <p className="draft-help">
                    Use the player ID shown in the catalog. Templates contain zero totals to replace
                    with verified data, not live statistics.
                  </p>
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
                        } catch (error) {
                          await refresh()
                          throw error
                        }
                        setMessage('Statistics imported.')
                        await refresh()
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
                    void run(() => refresh(0, search))
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
                  Select players across pages and searches to configure a draft pool.{' '}
                  {selected.length} selected.
                </p>
                <p>
                  Archived players are kept for reference and excluded from new draft pools.
                  Imported players start archived until you assign their tiers and eligible
                  positions.
                </p>
                <p role="status" aria-live="polite">
                  Showing {total ? offset + 1 : 0}–{Math.min(offset + players.length, total)} of{' '}
                  {total} players.
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
                              disabled={
                                busy ||
                                catalogLoading ||
                                pool?.status === 'published' ||
                                (p.archived && !selected.includes(p.id))
                              }
                              onChange={(e) => {
                                setPoolDirty(true)
                                setSelected((ids) =>
                                  e.target.checked
                                    ? [...ids, p.id]
                                    : ids.filter((id) => id !== p.id),
                                )
                              }}
                            />
                          </td>
                          <td>
                            {p.name}
                            {p.archived && ' (archived)'}
                            <code className="selectable-id">{p.id}</code>
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
                            <button
                              className="secondary-button"
                              disabled={busy}
                              onClick={() => edit(p)}
                            >
                              Edit<span className="sr-only"> {p.name}</span>
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() => setHistory({ id: p.id, name: p.name })}
                            >
                              History<span className="sr-only"> for {p.name}</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {catalogLoading && <p role="status">Loading players…</p>}
                {readErrors['Player catalog'] && <p role="alert">{readErrors['Player catalog']}</p>}
                {!catalogLoading && !readErrors['Player catalog'] && players.length === 0 && (
                  <p>No players found. Try another search or add a player above.</p>
                )}
                <nav className="action-row" aria-label="Player catalog pages">
                  <button
                    className="secondary-button"
                    disabled={busy || catalogLoading || offset === 0}
                    onClick={() => void run(() => refresh(Math.max(0, offset - PAGE_SIZE)))}
                  >
                    Previous players
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy || catalogLoading || offset + PAGE_SIZE >= total}
                    onClick={() => void run(() => refresh(offset + PAGE_SIZE))}
                  >
                    Next players
                  </button>
                </nav>
              </section>
              <section className="panel">
                <h2>Versioned player pools</h2>
                <SelectionReview
                  ids={selected}
                  known={players}
                  disabled={busy || pool?.status === 'published'}
                  onRemove={(id) => {
                    setSelected((ids) => ids.filter((p) => p !== id))
                    setPoolDirty(true)
                  }}
                />
                {pool?.status === 'published' && (
                  <p>
                    This version is read-only. Enter a new pool name and Create pool to carry this
                    selection into a new version, then save and publish it.
                  </p>
                )}
                <form
                  className="admin-search"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(async () => {
                      const p = await adminApi<Pool>('/admin/pools', 'POST', { name: poolName })
                      setPoolId(p.id)
                      setPoolLoaded(true)
                      await refresh()
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
                      id="new-pool-name"
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
                    disabled={busy}
                    onChange={(e) => void selectPool(e.target.value)}
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
                    disabled={busy || !poolLoaded || pool?.status !== 'draft' || !selected.length}
                    onClick={() =>
                      void run(async () => {
                        await adminApi(`/admin/pools/${poolId}/players`, 'PUT', {
                          player_ids: selected,
                        })
                        setPoolDirty(false)
                        setMessage('Pool selection saved. Ready for publication validation.')
                        await refresh()
                      })
                    }
                  >
                    Save selected players
                  </button>
                  <button
                    className="primary-button"
                    disabled={
                      busy ||
                      !poolLoaded ||
                      pool?.status !== 'draft' ||
                      poolDirty ||
                      !selected.length
                    }
                    onClick={() =>
                      void run(async () => {
                        if (
                          !window.confirm(
                            `Publish ${pool?.name} with ${selected.length} players? This freezes the saved eligibility and cannot be edited.`,
                          )
                        )
                          return
                        await adminApi(`/admin/pools/${poolId}/publish`, 'POST')
                        setMessage('Player pool published. Eligibility is now frozen.')
                        await refresh()
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
      {history && <AdminHistory {...history} onClose={() => setHistory(null)} />}
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
