import { useEffect, useRef, useState } from 'react';
import { Heading } from '../App';
import type { GameProps } from '../App';
import { api, freshGuess } from '../game';
interface Answer {
  match: boolean;
  name?: string;
  player?: { id: number; name: string };
}
export function GuessGame({ state, setState, catalog }: GameProps) {
  const g = state.guess,
    puzzles = catalog.puzzles,
    puzzle = puzzles[g.round];
  const [answer, setAnswer] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const guessInput = useRef<HTMLInputElement>(null);
  const nextAction = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (g.solved || g.finished) nextAction.current?.focus();
    else guessInput.current?.focus();
  }, [g.round, g.solved, g.finished]);
  useEffect(() => {
    if (error) guessInput.current?.focus();
  }, [error]);
  if (puzzles.length !== 3 || !puzzle)
    return (
      <>
        <Heading title="Guess the Player" />
        <p role="status">
          All three puzzle players must be imported to play. Import the missing records and reload.
        </p>
      </>
    );
  const update = async (reveal: boolean) => {
    if (lock.current || g.solved || g.finished) return;
    if (!reveal && !answer.trim()) {
      setError('Enter a player name to take your shot.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = reveal
        ? await api<{ name: string }>(`/games/guess/${puzzle.id}/reveal`, {})
        : await api<Answer>('/games/guess/validate', { puzzle_id: puzzle.id, answer });
      if (reveal || ('match' in response && response.match)) {
        setState((s) =>
          s.guess.solved
            ? s
            : {
                ...s,
                guess: {
                  ...s.guess,
                  solved: true,
                  score: s.guess.score + (reveal ? 0 : 60 - s.guess.clues * 10),
                  message: reveal
                    ? `The answer is ${response.name}. No points this round.`
                    : `Bucket! It’s ${response.name}. +${60 - g.clues * 10} points.`,
                },
              },
        );
      } else setError('Not quite. Try another name or reveal the next clue.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <>
      <Heading title="Guess the Player" copy="Fewer clues. More points." />
      <div className="game-layout">
        <section className="panel">
          <div className="scorebar">
            <span className="eyebrow">ROUND {g.round + 1} / 3</span>
            <span>{g.score} PTS</span>
          </div>
          {g.finished ? (
            <>
              <div className="question-mark">{g.score}</div>
              <h2>That’s the final buzzer.</h2>
              <p className="notice">
                {g.score >= 100
                  ? 'Elite basketball IQ.'
                  : 'Every round is a chance to learn the game.'}
              </p>
              <button
                ref={nextAction}
                className="primary"
                onClick={() => {
                  setState((s) => ({ ...s, guess: freshGuess() }));
                  setAnswer('');
                  setError('');
                }}
              >
                Play again ↗
              </button>
            </>
          ) : (
            <>
              <div className="question-mark">{g.solved ? '✓' : '?'}</div>
              <div className="clues">
                {puzzle.clues.slice(0, g.clues).map((c, i) => (
                  <div className="clue" key={c}>
                    <span>0{i + 1}</span>
                    {c}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void update(false);
                }}
              >
                <label htmlFor="guess-name">Who’s the player?</label>
                <div className="input-action">
                  <input
                    ref={guessInput}
                    id="guess-name"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={g.solved || busy}
                    placeholder="Enter the full player name"
                    autoComplete="off"
                  />
                  <button className="primary" disabled={g.solved || busy}>
                    {busy ? 'Checking…' : 'Lock in ↗'}
                  </button>
                </div>
              </form>
              <p className="notice" role="status">
                {error || g.message}
              </p>
              <div className="od-cluster">
                <button
                  className="secondary"
                  disabled={g.solved || g.clues === 5 || busy}
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      guess: { ...s.guess, clues: Math.min(5, s.guess.clues + 1) },
                    }));
                    setError('');
                  }}
                >
                  Reveal clue {Math.min(5, g.clues + 1)}
                </button>
                {g.solved ? (
                  <button
                    ref={nextAction}
                    className="primary"
                    onClick={() => {
                      setState((s) => {
                        if (!s.guess.solved || s.guess.finished) return s;
                        if (s.guess.round === 2)
                          return {
                            ...s,
                            guess: { ...s.guess, finished: true },
                            progress: {
                              ...s.progress,
                              played: s.progress.played + 1,
                              wins: s.progress.wins + (s.guess.score >= 100 ? 1 : 0),
                            },
                          };
                        return {
                          ...s,
                          guess: {
                            ...freshGuess(),
                            round: s.guess.round + 1,
                            score: s.guess.score,
                          },
                        };
                      });
                      setAnswer('');
                      setError('');
                    }}
                  >
                    {g.round === 2 ? 'See results' : 'Next player →'}
                  </button>
                ) : (
                  <button className="text-button" disabled={busy} onClick={() => void update(true)}>
                    Reveal answer
                  </button>
                )}
              </div>
            </>
          )}
        </section>
        <aside className="panel">
          <h3>Scoring</h3>
          <p>Start at 50 points. Each clue costs 10.</p>
          <p>Wrong guesses are free. Revealed answers score zero.</p>
        </aside>
      </div>
    </>
  );
}
