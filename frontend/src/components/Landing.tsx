import { Link } from 'react-router-dom';
export function Preview({ type }: { type: 'tic' | 'guess' | 'draft' }) {
  return (
    <div
      className="game-preview"
      role="img"
      aria-label={`${type === 'tic' ? 'Team intersection grid' : type === 'guess' ? 'Player guessing' : 'Fantasy draft'} preview`}
    >
      <div className="preview-screen" aria-hidden="true">
        <div className="preview-bar">
          <span>
            {type === 'tic'
              ? 'Cross-court grid'
              : type === 'guess'
                ? 'Round 1 / 3'
                : 'Team 1’s pick · League'}
          </span>
          <span>{type === 'tic' ? 'X’s turn' : type === 'guess' ? '50 pts' : 'Round 1 / 5'}</span>
        </div>
        {type === 'tic' ? (
          <div className="preview-grid">
            <span />
            {['LAL', 'MIA', 'BKN'].map((t) => (
              <span key={t}>{t}</span>
            ))}
            {['CLE', 'OKC', 'BOS'].map((t, r) => (
              <div className="preview-grid-row" key={t}>
                <span>{t}</span>
                {[0, 1, 2].map((c) => (
                  <i key={c}>{r === 0 && c === 0 ? '×' : r === 1 && c === 2 ? '○' : '+'}</i>
                ))}
              </div>
            ))}
          </div>
        ) : type === 'guess' ? (
          <>
            <div className="preview-mystery">?</div>
            <div className="preview-clue">
              01 <span>I was drafted in 2009.</span>
            </div>
            <div className="preview-input">
              <span>Player name</span>
              <b>Guess ↗</b>
            </div>
          </>
        ) : (
          <>
            <div className="preview-draft-label">
              <span>Available players</span>
              <span>G · F · C</span>
            </div>
            {['Nikola Jokić', 'Shai Gilgeous-Alexander', 'Giannis Antetokounmpo'].map((n, i) => (
              <div className="preview-player" key={n}>
                <span>0{i + 1}</span>
                <strong>
                  {n}
                  <small>{['C', 'G', 'F'][i]}</small>
                </strong>
                <b>+</b>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
export function Cards() {
  return (
    <div className="games-grid">
      {[
        {
          type: 'tic' as const,
          title: 'Basketball Tic-Tac-Toe',
          copy: 'Name shared players. Connect three.',
          meta: '2 players',
          detail: 'Pass & play',
          action: 'Play the grid',
          path: 'tic-tac-toe',
        },
        {
          type: 'guess' as const,
          title: 'Guess the Player',
          copy: 'Guess the player from career clues.',
          meta: 'Solo',
          detail: '3 rounds',
          action: 'Start guessing',
          path: 'guess-player',
        },
      ].map((g, i) => (
        <article className="game-card" key={g.type}>
          <div className="card-top">
            <span className="game-number">0{i + 1}</span>
            <span className="card-meta">{g.meta}</span>
          </div>
          <Preview type={g.type} />
          <div className="card-body">
            <h3>{g.title}</h3>
            <p>{g.copy}</p>
            <div className="card-bottom">
              <span>{g.detail}</span>
              <Link className="play" to={`/game/${g.path}`}>
                {g.action} <span>↗</span>
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
export function DraftFeature() {
  return (
    <section className="draft-feature">
      <div className="draft-feature-copy">
        <div className="eyebrow">THE MAIN GAME</div>
        <h2>Fantasy Draft</h2>
        <Link className="primary" to="/fantasy">
          Start a draft ↗
        </Link>
      </div>
      <Preview type="draft" />
    </section>
  );
}
export default function Landing({ played, drafts }: { played: number; drafts: number }) {
  return (
    <>
      <section className="home-intro">
        <h1>Pick your game.</h1>
      </section>
      <DraftFeature />
      <section>
        <div className="section-head">
          <h2>Minigames</h2>
        </div>
        <Cards />
      </section>
      <div className="home-progress">
        <span>
          {played} games · {drafts} drafts
        </span>
        <Link className="text-button" to="/locker">
          My locker →
        </Link>
      </div>
    </>
  );
}
