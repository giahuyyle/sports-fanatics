import { lazy, Suspense, useEffect } from 'react'
import { MotionConfig, motion } from 'motion/react'
import { useRoute, navigate } from './state/router'
import { useStore } from './state/store'
import { leaguePath } from './state/engine'
import { Shell } from './components/Shell'
import { EmptyState, RouteButton } from './components/ui'
import Landing from './pages/Landing'
import { LeagueForm, Leagues, Lobby } from './pages/Leagues'
import { Draft, Recap } from './pages/Draft'
import Fpl from './pages/Fpl'
import Settings from './pages/Settings'
const Admin = lazy(() => import('./pages/Admin'))
import type { League } from './state/types'

function LeaguePage({ league, path }: { league: League; path: string }) {
  useEffect(() => {
    const target = leaguePath(league)
    if (target !== path) navigate(target)
  }, [league, path])
  if (league.status === 'lobby') return <Lobby league={league} />
  if (league.status === 'complete') return <Recap league={league} />
  return <Draft league={league} />
}
export default function App() {
  const path = useRoute()
  const { profile, leagues } = useStore()
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(profile.reducedMotion)
  }, [profile.reducedMotion])
  useEffect(() => {
    document.title = `${path === '/' ? 'Draft night starts here' : path.startsWith('/fpl') ? 'FPL Assistant' : path.startsWith('/nba') ? 'NBA Fantasy' : path === '/settings' ? 'Profile & settings' : 'Your home court'} · Sports Fanatics`
  }, [path])
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector('h1')
      if (heading) {
        heading.setAttribute('tabindex', '-1')
        heading.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [path])
  let page
  if (path === '/') page = <Landing />
  else if (path === '/home' || path === '/nba') page = <Leagues home={path === '/home'} />
  else if (path === '/nba/create' || path === '/nba/join')
    page = <LeagueForm key={path} join={path.endsWith('join')} />
  else if (path === '/fpl') page = <Fpl />
  else if (path === '/settings') page = <Settings />
  else if (path === '/admin')
    page = (
      <Suspense fallback={<p role="status">Loading administration…</p>}>
        <Admin />
      </Suspense>
    )
  else {
    const match = path.match(/^\/nba\/leagues\/([^/]+)\/(lobby|draft|recap)$/)
    const league = match && leagues.find((l) => l.id === match[1])
    page = league ? (
      <LeaguePage key={league.id} league={league} path={path} />
    ) : (
      <EmptyState
        title="This page is out of bounds."
        description="That league or page isn’t available in this browser. Head back to your leagues or start a new one."
      >
        <RouteButton to="/nba">Back to leagues</RouteButton>
      </EmptyState>
    )
  }
  return (
    <MotionConfig reducedMotion={profile.reducedMotion ? 'always' : 'user'}>
      {path === '/' ? (
        page
      ) : (
        <Shell path={path}>
          <motion.div
            key={path.startsWith('/nba/leagues/') ? path.split('/').slice(0, 4).join('/') : path}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.22 }}
          >
            {page}
          </motion.div>
        </Shell>
      )}
    </MotionConfig>
  )
}
