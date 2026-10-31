import { useEffect, useRef, useState } from 'react';
import { Heading } from '../App';
import type { GameProps } from '../App';
import { api, freshGrid, normalize, outcome } from '../game';
import type { GridLayout } from '../game';
import TeamLabel from '../components/TeamLabel';

export default function GridGame({ state, setState }: GameProps) {
  const grid = state.grid;
  const layout = grid.layout;
  const result = outcome(grid.board);
  const [cell, setCell] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [gridError, setGridError] = useState('');
  const [gridRetry, setGridRetry] = useState(0);
  const [players, setPlayers] = useState<{ id: number; full_name: string }[] | null>(null);
  const [playerError, setPlayerError] = useState('');
  const [retry, setRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const playerInput = useRef<HTMLInputElement>(null);
  const lock = useRef(false);
  const generationLock = useRef(false);

  useEffect(() => {
    if (layout) return;
    const controller = new AbortController();
    api<GridLayout>('/games/grid?previous=', undefined, controller.signal)
      .then(next => setState(s => s.grid.layout ? s : { ...s, grid: { ...freshGrid(), layout: next } }))
      .catch(e => { if (!controller.signal.aborted) setGridError(e.message); });
    return () => controller.abort();
  }, [layout, gridRetry, setState]);

  useEffect(() => {
    const controller = new AbortController();
    api<{ id: number; full_name: string }[]>('/players', undefined, controller.signal)
      .then(setPlayers)
      .catch(e => { if (!controller.signal.aborted) setPlayerError(e.message); });
    return () => controller.abort();
  }, [retry]);

  async function newGame() {
    if (generationLock.current || lock.current || !layout) return;
    generationLock.current = true;
    setGenerating(true);
    setGridError('');
    const previous = [...layout.rows, ...layout.columns].map(t => t.id).join(',');
    try {
      const next = await api<GridLayout>(`/games/grid?previous=${encodeURIComponent(previous)}`);
      setState(s => ({ ...s, grid: { ...freshGrid(), layout: next } }));
    } catch (e) {
      setGridError((e as Error).message);
    } finally {
      generationLock.current = false;
      setGenerating(false);
    }
  }

  async function submit() {
    if (cell === null || !layout || lock.current || grid.board[cell] || result) return;
    const player = players?.find(p => normalize(p.full_name) === normalize(answer));
    if (!player) { setMessage('Choose a full player name from the imported catalog.'); return; }
    if (grid.board.some(c => c?.id === player.id)) { setMessage('That player has already been used. Pick another name.'); return; }
    lock.current = true;
    setBusy(true);
    try {
      const response = await api<{ match: boolean }>('/games/grid/validate', {
        player_id: player.id,
        team_ids: [layout.rows[Math.floor(cell / 3)].id, layout.columns[cell % 3].id],
      });
      if (!response.match) { setMessage('No recorded NBA appearances for both teams. Try another player.'); return; }
      setState(s => {
        if (s.grid.layout !== layout || s.grid.board[cell] || outcome(s.grid.board)) return s;
        const board = [...s.grid.board];
        board[cell] = { id: player.id, name: player.full_name, mark: s.grid.turn };
        const end = outcome(board);
        return {
          ...s,
          grid: { ...s.grid, board, turn: s.grid.turn === 'X' ? 'O' : 'X' },
          progress: { ...s.progress, played: s.progress.played + (end ? 1 : 0), wins: s.progress.wins + (end && end !== 'draw' ? 1 : 0) },
        };
      });
      dialog.current?.close();
      setMessage('');
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!layout) return <>
    <Heading title="Basketball Tic-Tac-Toe" />
    <section className="panel" role="status">
      <p>{gridError || 'Finding a random grid with nine playable matchups…'}</p>
      {gridError && <button className="secondary" onClick={() => { setGridError(''); setGridRetry(v => v + 1); }}>Try again</button>}
    </section>
  </>;

  return <>
    <Heading title="Basketball Tic-Tac-Toe" copy="Name a player who played for both teams." />
    <div className="game-layout">
      <section className="panel">
        <div className="scorebar"><p>2 players · Pass & play</p><span className="eyebrow">{result ? 'FINAL' : `TURN ${grid.turn}`}</span></div>
        <div className="grid-board">
          <div />
          {layout.columns.map(team => <TeamLabel team={team} key={team.id} />)}
          {layout.rows.map((team, r) => <div className="grid-row" key={team.id}>
            <TeamLabel team={team} />
            {layout.columns.map((column, c) => {
              const i = r * 3 + c, value = grid.board[i];
              return <button className="grid-cell" key={column.id} disabled={!!value || !!result || generating}
                aria-label={`${team.name} and ${column.name}${value ? `, ${value.name}, ${value.mark}` : ''}`}
                onClick={e => {
                  opener.current = e.currentTarget;
                  setCell(i); setAnswer(''); setMessage('');
                  dialog.current?.showModal(); playerInput.current?.focus();
                }}>
                {value ? <>{value.mark}<small>{value.name}</small></> : '+'}
              </button>;
            })}
          </div>)}
        </div>
        <p className="notice" role="status">{result === 'draw' ? 'Full court. This one is a draw.' : result ? `${result} wins! That’s a three-point connection.` : `${grid.turn} is up. Pick a square.`}</p>
        {gridError && <p className="notice" role="alert">{gridError} Your current game is unchanged. Try New game again.</p>}
        <button className="secondary" disabled={generating} onClick={() => void newGame()}>{generating ? 'Finding a new grid…' : 'New game'}</button>
      </section>
      <aside className="panel"><h3>How to play</h3><ol className="rule-list"><li>Select an open square.</li><li>Match both teams.</li><li>Use each name once.</li><li>Connect three to win.</li></ol><p>Historical NBA appearances count. Each new game draws six random teams with nine playable matchups.</p></aside>
    </div>
    <dialog aria-labelledby="cell-dialog-title" ref={dialog}
      onCancel={e => { if (busy) e.preventDefault(); }}
      onClose={() => {
        setCell(null);
        if (opener.current && !opener.current.disabled) opener.current.focus();
        else document.querySelector<HTMLButtonElement>('.grid-cell:not(:disabled), .game-layout .secondary')?.focus();
      }}>
      <div className="dialog-top"><h2 id="cell-dialog-title">Make your play</h2><button className="icon-button" aria-label="Close" disabled={busy} onClick={() => dialog.current?.close()}>×</button></div>
      <p>{cell !== null ? `${layout.rows[Math.floor(cell / 3)].name} + ${layout.columns[cell % 3].name}` : ''}</p>
      <form onSubmit={e => { e.preventDefault(); void submit(); }}>
        <label htmlFor="cell-player">Player name</label>
        <input ref={playerInput} id="cell-player" list="player-names" autoComplete="off" value={answer} disabled={busy} onChange={e => setAnswer(e.target.value)} placeholder="e.g. LeBron James" />
        <datalist id="player-names">{players?.map(p => <option key={p.id} value={p.full_name} />)}</datalist>
        {!players && <p role="status">{playerError || 'Loading players…'}</p>}
        {playerError && <button type="button" className="secondary" onClick={() => { setPlayerError(''); setRetry(v => v + 1); }}>Retry player catalog</button>}
        <p role="alert">{message}</p>
        <button className="primary" disabled={busy || !players?.length}>{busy ? 'Checking…' : 'Lock in player ↗'}</button>
      </form>
    </dialog>
  </>;
}
