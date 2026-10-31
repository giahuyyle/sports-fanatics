import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Landing, { Cards, DraftFeature } from './components/Landing';
import NotFound from './pages/NotFound';
import { api, loadState, storageKey } from './game';
import type { Catalog, State } from './game';
import { GuessGame } from './pages/Games';
const GridGame = lazy(() => import('./pages/GridGame'));
import Fantasy from './pages/Fantasy';
export interface GameProps { state: State; setState: Dispatch<SetStateAction<State>>; catalog: Catalog }
export function Heading({ title, copy }: { title: string; copy?: string }) { return <><Link className="back" to="/">← Home</Link><div className="page-heading"><h1>{title}</h1>{copy && <p>{copy}</p>}</div></>; }
export default function App() {
 const [state,setState] = useState(loadState);
 const [catalog,setCatalog] = useState<Catalog | null>(null);
 const [error,setError] = useState(''); const [retry,setRetry] = useState(0);
 const location = useLocation(); const main = useRef<HTMLElement>(null);
 useEffect(() => { try { localStorage.setItem(storageKey,JSON.stringify(state)); } catch { /* Keep playing in memory. */ } },[state]);
 useEffect(() => { main.current?.focus(); window.scrollTo(0,0); },[location.pathname]);
 useEffect(() => { const controller = new AbortController(); api<Catalog>('/games/catalog',undefined,controller.signal).then(data => {setCatalog(data);setError('');}).catch(e => {if (!controller.signal.aborted) setError(e.message);}); return () => controller.abort(); },[retry]);
 const props = catalog ? {state,setState,catalog} : null;
 const unavailable = <section className="panel" role="status"><h2>{error ? 'Game data unavailable' : 'Loading game data…'}</h2><p>{error || 'Connecting to the player catalog.'}</p>{error && <button className="secondary" onClick={() => {setError('');setRetry(v=>v+1);}}>Try again</button>}</section>;
 return <><Navbar/><main ref={main} tabIndex={-1}>{catalog && catalog.unavailable.length > 0 && <details className="data-notice"><summary>Some imported content is unavailable ({catalog.unavailable.length})</summary><p>{catalog.unavailable.join(', ')}. Import the missing records and reload to enable them.</p></details>}<Routes><Route path="/" element={<Landing {...state.progress}/>}/><Route path="/game" element={<><Heading title="Minigames"/><Cards/></>}/><Route path="/game/tic-tac-toe" element={props ? <Suspense fallback={<p role="status">Loading grid…</p>}><GridGame {...props}/></Suspense> : unavailable}/><Route path="/game/guess-player" element={props ? <GuessGame {...props}/> : unavailable}/><Route path="/fantasy" element={props ? <Fantasy {...props}/> : unavailable}/><Route path="/locker" element={<><Heading title="My locker" copy="Progress on this device."/><div className="profile-grid">{[[state.progress.played,'Games played'],[state.progress.wins,'Games won'],[state.progress.drafts,'Drafts completed']].map(([v,label])=><div className="panel od-stat" key={label}><strong className="result-stat">{v}</strong><span>{label}</span></div>)}</div><div className="section-head"><h2>Minigames</h2></div><Cards/><DraftFeature/></>}/><Route path="*" element={<NotFound/>}/></Routes></main><footer><Link className="wordmark" to="/">sports fanatics</Link><span>Fan playground · Curated demo rankings</span></footer></>;
}
