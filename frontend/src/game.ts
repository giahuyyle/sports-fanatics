export interface Player {
  id: number;
  name: string;
  team: string;
  position: string;
  rank: number;
}
export interface Team {
  id: number;
  name: string;
  abbreviation: string;
}
export interface Puzzle {
  id: string;
  clues: string[];
}
export interface Catalog {
  players: Player[];
  puzzles: Puzzle[];
  unavailable: string[];
  rankingLabel: string;
}
export interface Cell {
  id: number;
  name: string;
  mark: 'X' | 'O';
}
export interface GridLayout {
  rows: Team[];
  columns: Team[];
}
export interface GridState {
  layout: GridLayout | null;
  board: (Cell | null)[];
  turn: 'X' | 'O';
}
export interface GuessState {
  round: number;
  clues: number;
  score: number;
  solved: boolean;
  finished: boolean;
  message: string;
}
export interface Entry {
  team: string;
  manager: string;
}
export interface Pick {
  player: Player;
  owner: number;
  pick: number;
}
export interface Draft {
  name: string;
  entries: Entry[];
  picks: Pick[];
  ready: boolean;
}
export interface State {
  version: 1;
  progress: { played: number; wins: number; drafts: number };
  grid: GridState;
  guess: GuessState;
  draft: Draft | null;
  setup: { name: string; size: number; entries: Entry[] };
}
export const freshGrid = (): GridState => ({ layout: null, board: Array(9).fill(null), turn: 'X' });
export const freshGuess = (): GuessState => ({
  round: 0,
  clues: 1,
  score: 0,
  solved: false,
  finished: false,
  message: '',
});
export const freshState = (): State => ({
  version: 1,
  progress: { played: 0, wins: 0, drafts: 0 },
  grid: freshGrid(),
  guess: freshGuess(),
  draft: null,
  setup: {
    name: 'Hoops League',
    size: 4,
    entries: Array.from({ length: 8 }, (_, i) => ({
      team: `Team ${i + 1}`,
      manager: `Manager ${i + 1}`,
    })),
  },
});
export const storageKey = 'sf-state-v1';
export function loadState(): State {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || 'null');
    // Validate the complete persisted shape before allowing it into render/state logic.
    if (
      value?.version !== 1 ||
      !Array.isArray(value.grid?.board) ||
      value.grid.board.length !== 9 ||
      !['X', 'O'].includes(value.grid.turn)
    )
      return freshState();
    if (
      !value.grid.board.every(
        (c: Cell | null) =>
          c === null ||
          (Number.isInteger(c.id) && typeof c.name === 'string' && ['X', 'O'].includes(c.mark)),
      )
    )
      return freshState();
    if (
      !['played', 'wins', 'drafts'].every(
        (k) => Number.isInteger(value.progress?.[k]) && value.progress[k] >= 0,
      )
    )
      return freshState();
    if (
      !Number.isInteger(value.guess?.round) ||
      value.guess.round < 0 ||
      value.guess.round > 2 ||
      !Number.isInteger(value.guess.clues) ||
      value.guess.clues < 1 ||
      value.guess.clues > 5 ||
      !Number.isInteger(value.guess.score) ||
      value.guess.score < 0 ||
      value.guess.score > 150 ||
      typeof value.guess.message !== 'string' ||
      typeof value.guess.solved !== 'boolean' ||
      typeof value.guess.finished !== 'boolean'
    )
      return freshState();
    const entriesValid = (entries: unknown): entries is Entry[] =>
      Array.isArray(entries) &&
      entries.every((e) => typeof e?.team === 'string' && typeof e?.manager === 'string');
    if (
      !entriesValid(value.setup?.entries) ||
      value.setup.entries.length !== 8 ||
      typeof value.setup.name !== 'string' ||
      !Number.isInteger(value.setup.size) ||
      value.setup.size < 4 ||
      value.setup.size > 8
    )
      return freshState();
    const d = value.draft;
    if (
      d !== null &&
      (!d ||
        typeof d.name !== 'string' ||
        !entriesValid(d.entries) ||
        d.entries.length < 4 ||
        d.entries.length > 8 ||
        typeof d.ready !== 'boolean' ||
        !Array.isArray(d.picks) ||
        d.picks.length > d.entries.length * 5 ||
        !d.picks.every(
          (p: Pick, i: number) =>
            p.pick === i &&
            p.owner === ownerAt(i, d.entries.length) &&
            Number.isInteger(p.player?.id) &&
            typeof p.player.name === 'string' &&
            typeof p.player.team === 'string' &&
            typeof p.player.position === 'string' &&
            Number.isInteger(p.player.rank),
        ) ||
        new Set(d.picks.map((p: Pick) => p.player.id)).size !== d.picks.length)
    )
      return freshState();
    if (value.grid.layout === undefined) value.grid = freshGrid();
    const layout = value.grid.layout;
    if (
      layout !== null &&
      (!layout ||
        !Array.isArray(layout.rows) ||
        !Array.isArray(layout.columns) ||
        layout.rows.length !== 3 ||
        layout.columns.length !== 3 ||
        ![...layout.rows, ...layout.columns].every(
          (t) =>
            Number.isInteger(t?.id) &&
            t.id > 0 &&
            typeof t.name === 'string' &&
            typeof t.abbreviation === 'string',
        ) ||
        new Set([...layout.rows, ...layout.columns].map((t) => t.id)).size !== 6)
    )
      value.grid = freshGrid();
    return value;
  } catch {
    return freshState();
  }
}
export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
export const ownerAt = (pick: number, size: number) =>
  Math.floor(pick / size) % 2 ? size - 1 - (pick % size) : pick % size;
export function outcome(board: (Cell | null)[], blocked: number[] = []) {
  for (const a of [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ]) {
    if (board[a[0]] && a.every((i) => board[i]?.mark === board[a[0]]?.mark))
      return board[a[0]]!.mark;
  }
  return board.every((cell, i) => cell || blocked.includes(i)) ? 'draw' : null;
}
export const validSetup = (name: string, entries: Entry[]) =>
  Boolean(name.trim()) &&
  entries.every((e) => e.team.trim() && e.manager.trim()) &&
  new Set(entries.map((e) => e.team.trim().toLowerCase())).size === entries.length &&
  new Set(entries.map((e) => e.manager.trim().toLowerCase())).size === entries.length;
export const filterPlayers = (players: Player[], picks: Pick[], search: string, position: string) =>
  players.filter(
    (p) =>
      !picks.some((x) => x.player.id === p.id) &&
      (position === 'all' || p.position === position) &&
      normalize(p.name + p.team).includes(normalize(search)),
  );
export async function api<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}${path}`, {
    signal,
    ...(body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  if (!response.ok)
    throw new Error(
      response.status === 503 && path.startsWith('/games/grid?')
        ? 'Not enough imported player histories for a playable grid. Import more histories and try again.'
        : response.status === 404
          ? 'This content is unavailable in the imported data.'
          : 'Could not reach game data. Please try again.',
    );
  return response.json();
}
