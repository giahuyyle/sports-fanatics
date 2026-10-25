import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Check, Copy, Plus, Users, Volleyball } from 'lucide-react'
import { actions, useStore } from '../state/store'
import { leaguePath } from '../state/engine'
import { navigate } from '../state/router'
import { Avatar, EmptyState, Modal, PageTitle, RouteButton } from '../components/ui'
import type { League } from '../state/types'
import { FPL_ENABLED } from '../features'

export function Leagues({ home = false }: { home?: boolean }) {
  const { leagues, profile } = useStore()
  return (
    <>
      <PageTitle
        kicker={home ? 'YOUR PEOPLE. YOUR PICKS.' : 'NBA FANTASY / PRIVATE LEAGUES'}
        title={home ? `Your home court` : 'Your leagues, your rivals'}
        description={
          home
            ? `Good to see you, ${profile.name.split(' ')[0]}. Let’s get into the game.`
            : 'A little friendly competition starts here.'
        }
      >
        <RouteButton to="/nba/join" secondary>
          Join a league
        </RouteButton>
        <RouteButton to="/nba/create">Create a league</RouteButton>
      </PageTitle>
      <p className="local-notice">
        Browser-local demo. Sample leagues and guest managers are illustrative; invite codes work
        only in this browser.
      </p>
      {leagues.length ? (
        <>
          <div className="section-bar">
            <h2>{home ? 'Your leagues' : 'The lineup'}</h2>
            <span className="count-tag">
              {leagues.length} leagues · {leagues.filter((l) => l.status === 'live').length}{' '}
              drafting
            </span>
          </div>
          <div className="league-grid">
            {leagues.map((league) => (
              <LeagueTile key={league.id} league={league} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title="Your people are your home advantage."
          description="Start your first league, give your team a name, and get ready for draft night."
        >
          <RouteButton to="/nba/create">Create your first league</RouteButton>
          <RouteButton to="/nba/join" secondary>
            Join with a code
          </RouteButton>
          <button className="text-button" onClick={actions.restoreDemo}>
            Load sample leagues
          </button>
        </EmptyState>
      )}
      {home && FPL_ENABLED && (
        <section className="home-fpl">
          <div>
            <span className="eyebrow green">ALSO IN YOUR PLAYBOOK</span>
            <h2>A little data. A better game plan.</h2>
            <p className="muted">Compare your next FPL transfer with keeping your squad.</p>
          </div>
          <button className="secondary-button" onClick={() => navigate('/fpl')}>
            Open FPL Assistant
            <ArrowRight />
          </button>
        </section>
      )}
    </>
  )
}
function LeagueTile({ league }: { league: League }) {
  const user = league.participants.find((p) => p.id === league.userId)!
  return (
    <section className="league-tile">
      <div className="od-row">
        <span className="sport-icon">
          <Volleyball />
        </span>
        <span className="status-tag">
          {league.status === 'live'
            ? 'Live demo draft'
            : league.status === 'complete'
              ? 'Draft complete'
              : 'League lobby'}
        </span>
      </div>
      <div>
        <h3>{league.name}</h3>
        <p className="muted">Your team · {user.team}</p>
      </div>
      <div className="tile-meta">
        <span>
          {league.participants.length}/{league.capacity} managers
        </span>
        <span>{league.rosterSize}-player rosters</span>
        <span>{league.timer}s per pick</span>
      </div>
      <div className="participant-stack">
        {league.participants.map((p, i) => (
          <Avatar key={p.id} name={p.name} small index={i} />
        ))}
      </div>
      <button
        className={league.status === 'live' ? 'primary-button full' : 'secondary-button full'}
        onClick={() => navigate(leaguePath(league))}
      >
        {league.status === 'live'
          ? 'Enter draft room'
          : league.status === 'complete'
            ? 'View draft recap'
            : 'Open league lobby'}
        <ArrowRight />
      </button>
    </section>
  )
}
const FORM_KEY = 'sports-fanatics:league-form'
function savedForm() {
  try {
    return JSON.parse(sessionStorage.getItem(FORM_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}
export function LeagueForm({ join = false }: { join?: boolean }) {
  const { leagues, profile } = useStore()
  const [form, setForm] = useState(() => ({
    name: '',
    team: '',
    code: '',
    capacity: '4',
    rosterSize: '5',
    timer: '60',
    ...savedForm(),
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const change = (key: string, value: string) => {
    const next = { ...form, [key]: value }
    setForm(next)
    setError('')
    try {
      sessionStorage.setItem(FORM_KEY, JSON.stringify(next))
    } catch {
      /* Form remains usable without storage. */
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!form.team.trim() || (!join && !form.name.trim())) {
      setError('Give your team and league a name before continuing.')
      return
    }
    if (join) {
      const league = leagues.find((l) => l.code === form.code.trim().toUpperCase())
      if (!league) {
        setError('That invite code wasn’t found in this browser. Try OFFICE, or create a league.')
        return
      }
      if (league.status !== 'lobby') {
        setError('That draft has already started. Ask the creator about a new league.')
        return
      }
      if (league.participants.length >= league.capacity) {
        setError('That league is full. Create a league for your crew.')
        return
      }
      if (
        league.participants.some((p) => p.team.toLowerCase() === form.team.trim().toLowerCase())
      ) {
        setError('That team name is taken in this league. Choose another.')
        return
      }
      setBusy(true)
      await new Promise((resolve) => setTimeout(resolve, 250))
      actions.joinLeague(league.id, form.team.trim())
      navigate(`/nba/leagues/${league.id}/lobby`)
    } else {
      setBusy(true)
      await new Promise((resolve) => setTimeout(resolve, 250))
      const id = crypto.randomUUID()
      let code = ''
      do {
        code = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase()
      } while (leagues.some((l) => l.code === code))
      actions.addLeague({
        id,
        name: form.name.trim(),
        code,
        capacity: Number(form.capacity),
        rosterSize: Number(form.rosterSize),
        timer: Number(form.timer),
        participants: [{ id: 'you', name: profile.name, team: form.team.trim(), guest: false }],
        ownerId: 'you',
        userId: 'you',
        status: 'lobby',
        picks: [],
        queue: [],
        remaining: Number(form.timer),
      })
      navigate(`/nba/leagues/${id}/lobby`)
    }
    try {
      sessionStorage.removeItem(FORM_KEY)
    } catch {
      /* Optional storage. */
    }
  }
  return (
    <>
      <div className="breadcrumb">
        <button onClick={() => navigate('/nba')}>NBA Fantasy</button>
        <span>/</span>
        <b>{join ? 'Join a league' : 'Create a league'}</b>
      </div>
      <div className="setup-page-heading">
        <span className="eyebrow orange">GET YOUR PEOPLE TOGETHER</span>
        <h1>
          {join ? 'TAKE YOUR' : 'MAKE IT'}
          <br />
          <span className="orange">{join ? 'SEAT AT THE DRAFT.' : 'YOUR LEAGUE.'}</span>
        </h1>
      </div>
      <div className="league-form-layout">
        <section className="league-form-panel panel">
          <h2>{join ? 'Your invite. Your way in.' : 'Your people. Your league.'}</h2>
          <p className="muted">Bring a little competition to the group chat.</p>
          <div className="segmented">
            <button className={!join ? 'active' : ''} onClick={() => navigate('/nba/create')}>
              Create a league
            </button>
            <button className={join ? 'active' : ''} onClick={() => navigate('/nba/join')}>
              Join a league
            </button>
          </div>
          <form className="form-body" onSubmit={submit} noValidate>
            {join ? (
              <label className="field-label">
                Invite code *
                <input
                  autoComplete="off"
                  maxLength={12}
                  placeholder="e.g. OFFICE"
                  value={form.code}
                  onChange={(e) => change('code', e.target.value.toUpperCase())}
                  required
                  aria-describedby="invite-help"
                />
              </label>
            ) : (
              <label className="field-label">
                League name *
                <input
                  maxLength={40}
                  placeholder="The Sunday League"
                  value={form.name}
                  onChange={(e) => change('name', e.target.value)}
                  required
                  aria-invalid={!!error && !form.name.trim()}
                />
              </label>
            )}
            <label className="field-label">
              Your team name *
              <input
                maxLength={30}
                placeholder="Court Vision"
                value={form.team}
                onChange={(e) => change('team', e.target.value)}
                required
                aria-invalid={!!error && !form.team.trim()}
              />
            </label>
            {!join && (
              <>
                <div className="two-col">
                  <label className="field-label">
                    Participants
                    <select
                      value={form.capacity}
                      onChange={(e) => change('capacity', e.target.value)}
                    >
                      {[2, 4, 6].map((n) => (
                        <option key={n} value={n}>
                          {n} teams
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Roster size
                    <select
                      value={form.rosterSize}
                      onChange={(e) => change('rosterSize', e.target.value)}
                    >
                      {[3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n} players
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="field-label">
                  Time per pick
                  <select value={form.timer} onChange={(e) => change('timer', e.target.value)}>
                    {[30, 45, 60, 90].map((n) => (
                      <option key={n} value={n}>
                        {n} seconds
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <div className="lobby-callout">
              <p>
                {join
                  ? 'Joining adds a local manager to a league in this browser. Remote invites are not connected yet.'
                  : 'Snake draft · Random starting order · Reverses every round. Every NBA player can be picked once.'}
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button full" disabled={busy}>
              {busy ? 'Setting things up…' : join ? 'Join league' : 'Create league'}
              <ArrowRight />
            </button>
            <small className="muted" id="invite-help">
              * Required fields · local demo
            </small>
          </form>
        </section>
        <aside className="setup-aside">
          <span className="sport-icon">
            <Volleyball />
          </span>
          <h2>
            A LITTLE SETUP.
            <br />A LOT OF GAME.
          </h2>
          <p>
            Choose your crew size, roster size, and time per pick. Then bring your rivals into the
            local demo.
          </p>
          {[
            [
              'Just your inner circle',
              'Private league setup, with browser-local guest teams for now.',
            ],
            [
              'Snake drafts, simple rules',
              'Randomized starting order. Reversed each round. One player, one team.',
            ],
            [
              'Keep draft night moving',
              'Queue your favorites. Your first available player is picked if the clock runs out.',
            ],
          ].map(([a, b]) => (
            <div className="setup-feature" key={a}>
              <Check />
              <div>
                <strong>{a}</strong>
                <p>{b}</p>
              </div>
            </div>
          ))}
          <button className="text-button" onClick={() => navigate('/nba')}>
            Back to NBA Fantasy
            <ArrowRight />
          </button>
        </aside>
      </div>
    </>
  )
}
export function Invite({ league, onClose }: { league: League; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  return (
    <Modal title="Good leagues need good rivals." onClose={onClose}>
      <p>This is a browser-local invite code. It won’t connect friends on other devices yet.</p>
      <div className="invite-code">{league.code}</div>
      <button
        className="primary-button full"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(league.code)
            setCopied(true)
          } catch {
            setError(true)
          }
        }}
      >
        {copied ? <Check /> : <Copy />}
        {copied ? 'Code copied' : 'Copy invite code'}
      </button>
      {error && <p role="status">Copy isn’t available here. Select and copy the code above.</p>}
    </Modal>
  )
}
export function Lobby({ league }: { league: League }) {
  const [invite, setInvite] = useState(false)
  const [guest, setGuest] = useState(false)
  const [name, setName] = useState('')
  const [team, setTeam] = useState('')
  const [error, setError] = useState('')
  const owner = league.ownerId === league.userId
  const full = league.participants.length === league.capacity
  return (
    <>
      <PageTitle
        kicker="GET THE GROUP TOGETHER"
        title={league.name}
        description="Your draft night starts here. Get everyone in before tip-off."
      >
        <span className="status-tag">Waiting to draft</span>
      </PageTitle>
      <div className="lobby-grid">
        <section className="panel">
          <div className="section-bar">
            <h2>The starting lineup</h2>
            <span className="count-tag">
              {league.participants.length}/{league.capacity} joined
            </span>
          </div>
          <div className="participants-list">
            {league.participants.map((p, i) => (
              <div key={p.id} className="participant-row">
                <Avatar name={p.name} index={i} />
                <div className="od-field">
                  <strong>
                    {p.name} {p.id === league.userId && <span className="you-tag">YOU</span>}
                  </strong>
                  <small>
                    {p.team}
                    {p.guest ? ' · local guest' : ''}
                  </small>
                </div>
                <span className="status-tag">{p.id === league.ownerId ? 'Creator' : 'Ready'}</span>
              </div>
            ))}
            {Array.from({ length: league.capacity - league.participants.length }, (_, i) => (
              <button
                key={i}
                className="participant-row open-participant"
                onClick={() => (owner ? setGuest(true) : setInvite(true))}
              >
                <span className="avatar empty">
                  <Plus />
                </span>
                <span className="od-field">
                  <strong>Room for a rival</strong>
                  <small>{owner ? 'Add a local guest team' : 'Waiting for the creator'}</small>
                </span>
              </button>
            ))}
          </div>
          <div className="lobby-callout">
            <p>
              The starting order is randomized when the creator starts. It reverses every round: A →
              B → C → D, then D → C → B → A.
            </p>
          </div>
          <p className="local-notice" style={{ padding: '0 24px' }}>
            Guest managers make simulated picks. This demo runs in your browser.
          </p>
        </section>
        <aside className="od-stack">
          <section className="panel settings-panel">
            <span className="eyebrow">THE GAME PLAN</span>
            <h2>League settings</h2>
            {[
              ['Draft format', 'Snake draft'],
              ['Participants', `${league.capacity} teams`],
              ['Roster size', `${league.rosterSize} players`],
              ['Time per pick', `${league.timer} seconds`],
              ['Visibility', 'Private · local demo'],
            ].map(([k, v]) => (
              <div className="settings-line" key={k}>
                <span>{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
            <button
              className="primary-button full"
              disabled={!owner || !full}
              onClick={() => {
                actions.startLeague(league.id)
                navigate(`/nba/leagues/${league.id}/draft`)
              }}
            >
              Start the draft
              <ArrowRight />
            </button>
            <p className="draft-help">
              {!owner
                ? 'Only the league creator can start this draft.'
                : full
                  ? 'Everyone is here. Ready when you are.'
                  : `Waiting for ${league.capacity - league.participants.length} more teams.`}
            </p>
          </section>
          <section className="invite-card">
            <Users />
            <h3>Good leagues need good rivals.</h3>
            <p>Keep the code handy for your local setup.</p>
            <button className="invite-code" onClick={() => setInvite(true)}>
              {league.code}
              <Copy />
            </button>
            <button className="text-button orange" onClick={() => setInvite(true)}>
              Invite details
              <ArrowRight />
            </button>
          </section>
        </aside>
      </div>
      {invite && <Invite league={league} onClose={() => setInvite(false)} />}
      {guest && (
        <Modal title="Add a local guest team" onClose={() => setGuest(false)}>
          <p>This manager will make simulated draft picks.</p>
          <form
            className="form-body"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim() || !team.trim()) {
                setError('Enter a manager name and a team name.')
                return
              }
              if (
                league.participants.some((p) => p.team.toLowerCase() === team.trim().toLowerCase())
              ) {
                setError('Choose a different team name.')
                return
              }
              actions.addGuest(league.id, name.trim(), team.trim())
              setName('')
              setTeam('')
              setError('')
              setGuest(false)
            }}
          >
            <label className="field-label">
              Manager name
              <input
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field-label">
              Team name
              <input
                required
                maxLength={30}
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button full">
              Add guest team
              <Plus />
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
