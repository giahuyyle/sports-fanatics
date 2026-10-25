import { Fragment, useEffect, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Clock3,
  Eye,
  EyeOff,
  ListPlus,
  Plus,
  Search,
  Users,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import { actions } from '../state/store'
import { currentParticipant, snakeIndex } from '../state/engine'
import { playerById, players } from '../state/data'
import { Avatar, Modal, PageTitle, PlayerPhoto, RouteButton } from '../components/ui'
import { Invite } from './Leagues'
import { PlayerCard } from '../components/PlayerCard'
import { NBA_AFFILIATION_CONTEXT, SAMPLE_STATS_CONTEXT } from '../state/player-data-context'
import type { League, Player } from '../state/types'

function useConnection() {
  const [online, setOnline] = useState(navigator.onLine)
  const [visible, setVisible] = useState(!document.hidden)
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine)
    const visibility = () => setVisible(!document.hidden)
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  return { online, visible }
}
export function Draft({ league }: { league: League }) {
  const [selectedId, setSelectedId] = useState(1628983)
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState('')
  const [team, setTeam] = useState('')
  const [showDrafted, setShowDrafted] = useState(false)
  const [sort, setSort] = useState<'rank' | 'points' | 'rebounds' | 'assists'>('rank')
  const [mobile, setMobile] = useState('players')
  const [rosterTab, setRosterTab] = useState('roster')
  const [fullBoard, setFullBoard] = useState(false)
  const [invite, setInvite] = useState(false)
  const [connection, setConnection] = useState(false)
  const [simulatedOffline, setSimulatedOffline] = useState(false)
  const { online, visible } = useConnection()
  const connected = online && !simulatedOffline
  const participant = currentParticipant(league)
  const ownTurn = participant?.id === league.userId
  const count = league.picks.length
  const [initialPick] = useState(league.picks.length)
  const [dismissedPick, setDismissedPick] = useState(league.picks.length)
  useEffect(() => {
    if (count <= initialPick) return
    const timeout = setTimeout(() => setDismissedPick(count), 3500)
    return () => clearTimeout(timeout)
  }, [count, initialPick])
  const total = league.capacity * league.rosterSize
  useEffect(() => {
    if (!connected || !visible || league.status !== 'live') return
    const interval = setInterval(() => actions.tick(league.id, count), 1000)
    return () => clearInterval(interval)
  }, [connected, visible, league.id, league.status, count])
  useEffect(() => {
    if (ownTurn || !connected || !visible || league.status !== 'live') return
    const timeout = setTimeout(() => actions.autoPick(league.id, count), 3500)
    return () => clearTimeout(timeout)
  }, [ownTurn, connected, visible, league.id, league.status, count])
  const drafted = new Set(league.picks.map((p) => p.playerId))
  const selected = playerById(selectedId)
  const filtered = players
    .filter(
      (p) =>
        (showDrafted || !drafted.has(p.id)) &&
        (!position || p.position === position) &&
        (!team || p.team === team) &&
        p.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => (sort === 'rank' ? a.rank - b.rank : b[sort] - a[sort]))
  const roster = league.picks.filter((p) => p.participantId === league.userId)
  const last = league.picks.at(-1)
  const next =
    count + 1 < total ? league.participants[snakeIndex(count + 1, league.capacity)] : null
  const clock = `${String(Math.floor(league.remaining / 60)).padStart(2, '0')}:${String(league.remaining % 60).padStart(2, '0')}`
  return (
    <>
      <div className="breadcrumb">
        <span>NBA Fantasy</span>
        <span>/</span>
        <b>Draft room</b>
      </div>
      <PageTitle
        kicker="DRAFT NIGHT / YOUR INNER CIRCLE"
        title={league.name}
        description="Draft together. Talk a little trash. Build something great."
      >
        <div className="participant-stack">
          {league.participants.map((p, i) => (
            <Avatar key={p.id} name={p.name} small index={i} />
          ))}
        </div>
        <button className="secondary-button" onClick={() => setInvite(true)}>
          <Users size={16} /> Invite
        </button>
        <button
          className="icon-button bordered"
          aria-label="Connection status"
          onClick={() => setConnection(true)}
        >
          {connected ? <Wifi /> : <WifiOff />}
        </button>
      </PageTitle>
      <div className="draft-progress">
        <div className="od-row">
          <span className="progress-number">{String(count + 1).padStart(2, '0')}</span>
          <span className="od-field">
            <strong>
              Pick {count + 1} of {total}
            </strong>
            <small>
              Round {Math.floor(count / league.capacity) + 1} of {league.rosterSize}
            </small>
          </span>
        </div>
        <div className="progress-track">
          <span style={{ transform: `scaleX(${count / total})` }} />
        </div>
        <span className="snake-label">Snake draft</span>
      </div>
      <section
        className={`turn-banner ${ownTurn ? '' : 'opponent-turn'} ${!connected ? 'disconnected' : ''}`}
        aria-label="Current draft turn"
      >
        <div className="turn-icon">{connected ? <Clock3 /> : <WifiOff />}</div>
        <div className="od-field turn-copy">
          <span className="eyebrow">
            {!connected
              ? 'OFFLINE / DRAFT PAUSED'
              : ownTurn
                ? 'YOU’RE ON THE CLOCK'
                : 'YOUR RIVAL IS THINKING'}
          </span>
          <h2>
            {!connected
              ? 'Your picks and queue are safe.'
              : ownTurn
                ? 'You’re up. Make it count.'
                : `${participant.name.split(' ')[0]} is on the clock.`}
          </h2>
        </div>
        <div className="next-up">
          <span>UP NEXT</span>
          <strong>
            {next
              ? `${next.id === league.userId ? 'You' : next.name.split(' ')[0]} · ${next.team}`
              : 'The final pick'}
          </strong>
        </div>
        <div
          className={`countdown ${league.remaining <= 10 ? 'urgent' : ''}`}
          aria-label={`${league.remaining} seconds remaining`}
        >
          <span>{clock}</span>
        </div>
      </section>
      <p className="draft-announcement" role="status">
        {last && (
          <>
            {last.automatic ? 'Automatic pick' : 'Last pick'}: {playerById(last.playerId).name} →{' '}
            {league.participants.find((p) => p.id === last.participantId)?.team}.
          </>
        )}
      </p>
      <div
        className="mobile-draft-tabs"
        role="tablist"
        aria-label="Draft workspace"
        onKeyDown={(event) => {
          const tabs = ['board', 'players', 'roster']
          const index = tabs.indexOf(mobile)
          const target =
            event.key === 'ArrowRight'
              ? (index + 1) % 3
              : event.key === 'ArrowLeft'
                ? (index + 2) % 3
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? 2
                    : -1
          if (target >= 0) {
            event.preventDefault()
            setMobile(tabs[target])
            event.currentTarget.querySelectorAll<HTMLButtonElement>('button')[target].focus()
          }
        }}
      >
        {['board', 'players', 'roster'].map((tab) => (
          <button
            key={tab}
            role="tab"
            tabIndex={mobile === tab ? 0 : -1}
            aria-selected={mobile === tab}
            className={mobile === tab ? 'active' : ''}
            onClick={() => setMobile(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
            {tab === 'roster' && <span>{roster.length}</span>}
          </button>
        ))}
      </div>
      <section
        className={`draft-board panel ${mobile === 'board' ? 'mobile-current' : ''}`}
        aria-label="Draft board"
      >
        <div className="section-bar">
          <div className="od-row">
            <h2>Draft board</h2>
            <span className="subtle-label">SNAKE DRAFT</span>
          </div>
          <button className="text-button" onClick={() => setFullBoard(!fullBoard)}>
            {fullBoard ? 'Current round' : 'Full board'}
          </button>
        </div>
        <div
          className="board-scroll"
          tabIndex={0}
          role="region"
          aria-label="Scrollable rounds and picks"
        >
          <div
            className="board-grid"
            style={{ gridTemplateColumns: `56px repeat(${league.capacity}, minmax(150px, 1fr))` }}
          >
            <div className="board-corner">ROUND</div>
            {league.participants.map((p, i) => (
              <div key={p.id} className={`team-head ${p.id === league.userId ? 'is-you' : ''}`}>
                <Avatar name={p.name} small index={i} />
                <span className="od-field">
                  <strong>{p.team}</strong>
                  <small>{p.id === league.userId ? 'You' : p.name.split(' ')[0]}</small>
                </span>
              </div>
            ))}
            {Array.from({ length: fullBoard ? league.rosterSize : 1 }, (_, offset) =>
              fullBoard ? offset : Math.floor(count / league.capacity),
            ).map((round) => (
              <Fragment key={round}>
                <div className="round-number">
                  {String(round + 1).padStart(2, '0')}
                  {round % 2 ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
                </div>
                {league.participants.map((p, column) => {
                  const index =
                    round * league.capacity + (round % 2 ? league.capacity - 1 - column : column)
                  const pick = league.picks[index],
                    player = pick ? playerById(pick.playerId) : null
                  return (
                    <div
                      key={p.id}
                      className={`pick-cell ${player ? 'picked' : index === count ? 'on-clock' : ''}`}
                    >
                      <span className="pick-number">
                        {round + 1}.{String((index % league.capacity) + 1).padStart(2, '0')}
                      </span>
                      {player ? (
                        <button
                          className="pick-player"
                          onClick={() => {
                            setSelectedId(player.id)
                            setMobile('players')
                          }}
                          title={player.name}
                        >
                          <PlayerPhoto player={player} />
                          <span className="od-field">
                            <strong>{player.name.split(' ').slice(-1).join(' ')}</strong>
                            <small>
                              {player.team} · {player.position}
                              {pick.automatic ? ' · Auto' : ''}
                            </small>
                          </span>
                        </button>
                      ) : (
                        <div className="od-field">
                          <strong className={index === count ? 'orange' : ''}>
                            {index === count ? (ownTurn ? 'Your pick' : 'On the clock') : '—'}
                          </strong>
                          <small>{index === count ? 'Make it count.' : 'Awaiting pick'}</small>
                        </div>
                      )}
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </section>
      <div className="draft-workspace">
        <div className="pool-column">
          <section
            className={`players-panel panel ${mobile === 'players' ? 'mobile-current' : ''}`}
          >
            <div className="section-bar">
              <div className="od-row">
                <h2>Find your franchise player</h2>
                <span className="count-tag">{players.length - drafted.size} available</span>
              </div>
              <button
                className="icon-button"
                aria-label={showDrafted ? 'Hide drafted players' : 'Show drafted players'}
                aria-pressed={showDrafted}
                onClick={() => setShowDrafted(!showDrafted)}
              >
                {showDrafted ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <div className="player-filters">
              <label className="search-input">
                <Search size={18} />
                <span className="sr-only">Search players</span>
                <input
                  placeholder="Find your next pick…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <div className="filter-selects">
                <label>
                  <span className="sr-only">Position</span>
                  <select value={position} onChange={(e) => setPosition(e.target.value)}>
                    <option value="">All positions</option>
                    {['PG', 'SG', 'SF', 'PF', 'C'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">NBA team</span>
                  <select value={team} onChange={(e) => setTeam(e.target.value)}>
                    <option value="">All teams</option>
                    {[...new Set(players.map((p) => p.team))].sort().map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="player-table">
              <div className="table-header">
                <button onClick={() => setSort('rank')} aria-label="Sort by sample rank">
                  #
                </button>
                <span>PLAYER</span>
                {(['points', 'rebounds', 'assists'] as const).map((key, i) => (
                  <button
                    key={key}
                    className={sort === key ? 'orange' : ''}
                    onClick={() => setSort(key)}
                    aria-label={`Sort by ${key}`}
                  >
                    {['PTS', 'REB', 'AST'][i]}
                    {sort === key && <ArrowDown size={12} />}
                  </button>
                ))}
                <span className="sr-only">Queue</span>
              </div>
              <div className="table-body">
                {filtered.length ? (
                  filtered.map((p) => (
                    <div
                      key={p.id}
                      className={`player-row ${selectedId === p.id ? 'selected' : ''} ${drafted.has(p.id) ? 'drafted' : ''}`}
                    >
                      <span className="rank">{String(p.rank).padStart(2, '0')}</span>
                      <button
                        className="player-identity"
                        aria-pressed={selectedId === p.id}
                        onClick={() => setSelectedId(p.id)}
                      >
                        <span className="photo-disc">
                          <PlayerPhoto player={p} />
                        </span>
                        <span className="od-field">
                          <strong>{p.name}</strong>
                          <small>
                            {drafted.has(p.id) ? 'Drafted · ' : ''}
                            {p.team}
                            <span className="position-tag">{p.position}</span>
                          </small>
                        </span>
                      </button>
                      <span className="stat-value">{p.points.toFixed(1)}</span>
                      <span className="stat-value">{p.rebounds.toFixed(1)}</span>
                      <span className="stat-value">{p.assists.toFixed(1)}</span>
                      <button
                        className={`queue-button ${league.queue.includes(p.id) ? 'queued' : ''}`}
                        disabled={drafted.has(p.id)}
                        aria-label={`${league.queue.includes(p.id) ? 'Unqueue' : 'Queue'} ${p.name}`}
                        aria-pressed={league.queue.includes(p.id)}
                        onClick={() => actions.toggleQueue(league.id, p.id)}
                      >
                        {league.queue.includes(p.id) ? <Check size={16} /> : <Plus size={16} />}
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="pool-empty">
                    <Search />
                    <h3>No players match that search.</h3>
                    <button
                      className="text-button orange"
                      onClick={() => {
                        setQuery('')
                        setTeam('')
                        setPosition('')
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="table-footer">
              <span>
                {NBA_AFFILIATION_CONTEXT} · {SAMPLE_STATS_CONTEXT} · illustrative rankings
              </span>
            </div>
          </section>
          <p className="draft-bottom-note">
            Local simulation · opponents pick automatically · the clock pauses away from this page.
          </p>
        </div>
        <aside className={`draft-aside ${mobile === 'players' ? 'show-detail-mobile' : ''}`}>
          <PlayerDetail
            player={selected}
            unavailable={drafted.has(selected.id)}
            ownTurn={ownTurn}
            connected={connected}
            queued={league.queue.includes(selected.id)}
            onQueue={() => actions.toggleQueue(league.id, selected.id)}
            onDraft={() => actions.pick(league.id, selected.id, count)}
          />
          <section className={`roster-panel panel ${mobile === 'roster' ? 'mobile-current' : ''}`}>
            <div className="section-bar roster-tabs">
              <button
                className={rosterTab === 'roster' ? 'active' : ''}
                onClick={() => setRosterTab('roster')}
              >
                My roster{' '}
                <span>
                  {roster.length}/{league.rosterSize}
                </span>
              </button>
              <button
                id="personal-queue-tab"
                className={rosterTab === 'queue' ? 'active' : ''}
                onClick={() => setRosterTab('queue')}
              >
                Queue <span>{league.queue.length}</span>
              </button>
            </div>
            {rosterTab === 'roster' ? (
              <div className="roster-list">
                {Array.from({ length: league.rosterSize }, (_, i) => {
                  const player = roster[i] && playerById(roster[i].playerId)
                  return (
                    <div className="roster-row" key={i}>
                      <span className="slot-tag">{String(i + 1).padStart(2, '0')}</span>
                      {player ? (
                        <PlayerPhoto player={player} />
                      ) : (
                        <span className="open-slot">
                          <Plus size={16} />
                        </span>
                      )}
                      <div className="od-field">
                        <strong>{player?.name ?? 'Open roster spot'}</strong>
                        <small>
                          {player ? `${player.team} · ${player.position}` : 'Any position'}
                        </small>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="queue-list">
                {league.queue.length ? (
                  league.queue.map((id, i) => (
                    <div className="queue-entry" key={id}>
                      <span className="queue-priority">{i + 1}</span>
                      <span>{playerById(id).name}</span>
                      <div className="queue-actions">
                        <button
                          className="icon-button"
                          disabled={i === 0}
                          aria-label={`Move ${playerById(id).name} up`}
                          onClick={() => actions.moveQueue(league.id, id, -1)}
                        >
                          <ArrowUp />
                        </button>
                        <button
                          className="icon-button"
                          disabled={i === league.queue.length - 1}
                          aria-label={`Move ${playerById(id).name} down`}
                          onClick={() => actions.moveQueue(league.id, id, 1)}
                        >
                          <ArrowDown />
                        </button>
                        <button
                          className="icon-button"
                          data-queue-remove
                          aria-label={`Remove ${playerById(id).name} from queue`}
                          onClick={() => {
                            actions.toggleQueue(league.id, id)
                            requestAnimationFrame(() => {
                              const next =
                                document.querySelector<HTMLButtonElement>('[data-queue-remove]') ??
                                document.querySelector<HTMLButtonElement>('#personal-queue-tab')
                              next?.focus()
                            })
                          }}
                        >
                          <X />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="pool-empty">
                    <ListPlus />
                    <p>Your next pick starts with a shortlist.</p>
                    <p className="muted">Use + beside a player to queue them.</p>
                  </div>
                )}
              </div>
            )}
            <div className="roster-note">
              <span>
                {rosterTab === 'queue'
                  ? 'First available queued player is your timeout pick.'
                  : 'Flexible roster · draft any position'}
              </span>
            </div>
          </section>
        </aside>
      </div>
      {count > initialPick && dismissedPick !== count && last && (
        <div className="toast-region">
          <Check className="green" />
          <p>
            {last.automatic ? 'Automatic pick' : 'Pick confirmed'} ·{' '}
            {playerById(last.playerId).name} joins{' '}
            {league.participants.find((p) => p.id === last.participantId)?.team}.
          </p>
          <button
            className="icon-button"
            aria-label="Dismiss pick notification"
            onClick={() => setDismissedPick(count)}
          >
            <X />
          </button>
        </div>
      )}
      {invite && <Invite league={league} onClose={() => setInvite(false)} />}{' '}
      {connection && (
        <Modal title="Draft connection" onClose={() => setConnection(false)}>
          <p>
            {online ? 'Your browser is online.' : 'Your browser is offline.'} This draft uses local
            data. Test an interrupted session below; your picks and queue are retained.
          </p>
          <button
            className="secondary-button full"
            onClick={() => {
              setSimulatedOffline(!simulatedOffline)
              setConnection(false)
            }}
          >
            {simulatedOffline ? 'Resume local draft' : 'Simulate going offline'}
          </button>
        </Modal>
      )}
    </>
  )
}
function PlayerDetail({
  player,
  unavailable,
  ownTurn,
  connected,
  queued,
  onQueue,
  onDraft,
}: {
  player: Player
  unavailable: boolean
  ownTurn: boolean
  connected: boolean
  queued: boolean
  onQueue: () => void
  onDraft: () => void
}) {
  return (
    <section className="player-detail panel">
      <div className="detail-top">
        <span className="eyebrow">THE SCOUTING REPORT</span>
        <button
          className="icon-button"
          disabled={unavailable}
          aria-label={`${queued ? 'Unqueue' : 'Queue'} selected player`}
          aria-pressed={queued}
          onClick={onQueue}
        >
          {queued ? <Check /> : <ListPlus />}
        </button>
      </div>
      <div className="spotlight-photo">
        <PlayerPhoto key={player.id} player={player} big decorative={false} />
        <span className="player-team-tag">{player.team}</span>
      </div>
      <div className="spotlight-body">
        <div className="od-row detail-position">
          <span className="position-tag">{player.position}</span>
          <span>
            {player.team} · {player.position}
          </span>
          <span className="rank-tag">RK {player.rank}</span>
        </div>
        <h2>{player.name}</h2>
        <div className="spotlight-stats">
          {[
            [player.points, 'POINTS'],
            [player.rebounds, 'REBOUNDS'],
            [player.assists, 'ASSISTS'],
          ].map(([n, label]) => (
            <div key={label} className="od-stat">
              <strong>{Number(n).toFixed(1)}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <button
          className="primary-button full"
          disabled={unavailable || !ownTurn || !connected}
          onClick={onDraft}
        >
          {unavailable
            ? 'Already drafted'
            : !connected
              ? 'Draft paused · offline'
              : !ownTurn
                ? 'Waiting for your turn'
                : `Draft ${player.name.split(' ')[0]}`}
          <ArrowRight />
        </button>
        <p className="draft-help">
          {unavailable
            ? 'This player belongs to another roster in this league.'
            : 'Once selected, this player is exclusively yours.'}
        </p>
      </div>
    </section>
  )
}
export function Recap({ league }: { league: League }) {
  const [teamId, setTeamId] = useState(league.userId)
  const participant = league.participants.find((p) => p.id === teamId)!
  return (
    <>
      <PageTitle
        kicker="THE PICKS ARE IN"
        title="Your roster, ready"
        description="Draft night is in the books. Here’s how your team came together."
      >
        <RouteButton to="/nba" secondary>
          Back to leagues
        </RouteButton>
      </PageTitle>
      <div className="section-bar">
        <div>
          <h2>{participant.team}</h2>
          <p className="muted">
            {participant.id === league.userId ? 'Your team' : participant.name}
          </p>
        </div>
        <label className="field-label">
          Inspect a team
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {league.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.team}
                {p.id === league.userId ? ' (You)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="recap-roster">
        {league.picks
          .map((pick, index) => ({ pick, index }))
          .filter(({ pick }) => pick.participantId === teamId)
          .map(({ pick, index }) => {
            const player = playerById(pick.playerId)
            return (
              <PlayerCard
                key={player.id}
                player={player}
                round={Math.floor(index / league.capacity) + 1}
                pick={index + 1}
                automatic={pick.automatic}
              />
            )
          })}
      </div>
      <p className="local-notice">
        {NBA_AFFILIATION_CONTEXT}. {SAMPLE_STATS_CONTEXT}; portraits may show a different uniform.
        Season scoring is still being defined. This recap records selections only.
      </p>
    </>
  )
}
