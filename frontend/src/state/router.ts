import { useEffect, useState } from 'react'
let sandboxPath: string | null = null
const readPath = () => sandboxPath ?? (window.location.hash.slice(1) || '/')
let committedPath = readPath()
const guards = new Set<() => boolean>()
const mayLeave = () => [...guards].every((guard) => guard())
export function navigate(path: string) {
  if (path !== committedPath && !mayLeave()) return false
  committedPath = path
  sandboxPath = null
  try {
    window.location.hash = path
  } catch {
    sandboxPath = path
  }
  window.dispatchEvent(new Event('fanatics:navigate'))
  return true
}
export function useNavigationGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const guard = () => window.confirm('Discard unsaved changes and leave this workspace?')
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    guards.add(guard)
    window.addEventListener('beforeunload', unload)
    return () => {
      guards.delete(guard)
      window.removeEventListener('beforeunload', unload)
    }
  }, [dirty])
}
export function useRoute() {
  const [path, setPath] = useState(readPath)
  useEffect(() => {
    const sync = () => {
      sandboxPath = null
      const next = readPath()
      if (next !== committedPath && !mayLeave()) {
        window.history.replaceState(null, '', `#${committedPath}`)
        return
      }
      committedPath = next
      setPath(next)
      window.scrollTo(0, 0)
    }
    const localSync = () => {
      setPath(committedPath)
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', sync)
    window.addEventListener('fanatics:navigate', localSync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('fanatics:navigate', localSync)
    }
  }, [])
  return path.split('?')[0].replace(/\/$/, '') || '/'
}
