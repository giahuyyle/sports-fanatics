import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CircleHelp, House, Menu, Settings, Volleyball, X } from 'lucide-react'
import { Brand, Avatar } from './ui'
import { navigate } from '../state/router'
import { getStorageWarning, useStore } from '../state/store'
import { leaguePath } from '../state/engine'
import { FPL_ENABLED } from '../features'

export function Shell({ path, children }: { path: string; children: ReactNode }) {
  const state = useStore()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const resize = () => {
      if (!window.matchMedia('(max-width: 767px)').matches) setOpen(false)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    if (!open) return
    const menu = menuRef.current!
    const trigger = triggerRef.current
    const buttons = () =>
      [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')].filter(
        (b) => b.getClientRects().length,
      )
    buttons()[0]?.focus()
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
      }
      if (event.key === 'Tab') {
        const list = buttons(),
          first = list[0],
          last = list.at(-1)
        if (
          !menu.contains(document.activeElement) ||
          (event.shiftKey && document.activeElement === first)
        ) {
          event.preventDefault()
          ;(event.shiftKey ? last : first)?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', keyboard)
    return () => {
      document.removeEventListener('keydown', keyboard)
      trigger?.focus()
    }
  }, [open])
  const fpl = FPL_ENABLED && path.startsWith('/fpl')
  const leagueId = path.match(/^\/nba\/leagues\/([^/]+)/)?.[1]
  const league = state.leagues.find((l) => l.id === leagueId)
  const nav = [
    { name: 'Home', to: '/home', icon: House },
    { name: 'NBA Fantasy', to: '/nba', icon: Volleyball },
    ...(FPL_ENABLED ? [{ name: 'FPL Assistant', to: '/fpl', icon: Volleyball }] : []),
    { name: 'Profile & settings', to: '/settings', icon: Settings },
    { name: 'NBA administration', to: '/admin', icon: Settings },
  ]
  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  return (
    <div className={`app ${fpl ? 'fpl-theme' : ''}`}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault()
          document.getElementById('main-content')?.focus()
          document.getElementById('main-content')?.scrollIntoView()
        }}
      >
        Skip to content
      </a>
      <div
        ref={menuRef}
        className={`sidebar ${open ? 'mobile-open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
        aria-label={open ? 'App navigation' : undefined}
      >
        <Brand />
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <nav aria-label="Main navigation">
          {nav.map(({ name, to, icon: Icon }) => (
            <button
              key={to}
              className={`nav-button ${path === to || (to === '/nba' && path.startsWith('/nba/')) ? 'active' : ''} ${to === '/fpl' ? 'fpl' : ''}`}
              aria-current={
                path === to || (to === '/nba' && path.startsWith('/nba/')) ? 'page' : undefined
              }
              onClick={() => go(to)}
            >
              <Icon className="od-icon" />
              {name}
            </button>
          ))}
        </nav>
        <button className="profile-button" onClick={() => go('/settings')}>
          <Avatar name={state.profile.name} small />
          <span>{state.profile.name}</span>
        </button>
      </div>
      <div className="app-body" inert={open}>
        <header className="topbar">
          <button
            ref={triggerRef}
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Menu />
          </button>
          <div className="sport-switch">
            <button className={!fpl ? 'active' : ''} onClick={() => go('/nba')}>
              NBA Fantasy
            </button>
            {FPL_ENABLED && (
              <button className={fpl ? 'active fpl-active' : ''} onClick={() => go('/fpl')}>
                FPL Assistant
              </button>
            )}
          </div>
          {league && (
            <label className="league-switch-label">
              <span className="sr-only">Switch league</span>
              <select
                aria-label="Switch league"
                value={league.id}
                onChange={(e) => {
                  const next = state.leagues.find((l) => l.id === e.target.value)
                  if (next) go(leaguePath(next))
                }}
              >
                {state.leagues.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="prototype-label">
            {path === '/admin' ? 'Administration' : 'Local demo · sample data'}
          </span>
          <button
            className="icon-button"
            aria-label="About this demo"
            onClick={() => go('/settings')}
          >
            <CircleHelp size={18} />
          </button>
        </header>
        {getStorageWarning() && (
          <p className="storage-warning" role="status">
            {getStorageWarning()}
          </p>
        )}
        <main id="main-content" tabIndex={-1}>
          <div className="page-content">{children}</div>
          <footer className="app-footer">
            <span>
              SPORTS FANATICS<span className="orange">.</span>
            </span>
            <span>Built for the love of the game.</span>
            <span>
              {path === '/admin' ? 'NBA administration' : 'Interactive prototype · sample data'}
            </span>
          </footer>
        </main>
      </div>
    </div>
  )
}
