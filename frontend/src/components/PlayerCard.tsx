import { useState } from 'react'
import type { CSSProperties } from 'react'
import { teamColor } from '../state/team-colors'
import { NBA_AFFILIATION_CONTEXT } from '../state/player-data-context'
import type { Player } from '../state/types'
import { PlayerPhoto } from './ui'

function TeamLogo({ team }: { team: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <span className="player-card-team" title={`${team} · ${NBA_AFFILIATION_CONTEXT}`}>
      {failed ? (
        <span>{team}</span>
      ) : (
        <img
          src={`/assets/teams/${team}.svg`}
          alt={`${team} team logo`}
          width={48}
          height={48}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  )
}

export function PlayerCard({
  player,
  round,
  pick,
  automatic,
}: {
  player: Player
  round: number
  pick: number
  automatic: boolean
}) {
  return (
    <article
      className="panel player-card recap-pick"
      style={{ '--team-color': teamColor(player.team) } as CSSProperties}
      aria-label={`${player.name}, ${player.position}, ${player.team}, round ${round}, pick ${pick}`}
    >
      <div className="player-card-portrait">
        <PlayerPhoto player={player} decorative />
      </div>
      <div className="player-card-identity">
        <span className="player-card-position" aria-label={`Primary position: ${player.position}`}>
          {player.position}
        </span>
        <h3>{player.name}</h3>
        <TeamLogo key={player.team} team={player.team} />
      </div>
      <footer className="player-card-footer">
        <span>
          Round {round} · Pick {pick}
        </span>
        <span className="status-tag">{automatic ? 'Automatic pick' : 'Manual pick'}</span>
      </footer>
    </article>
  )
}
