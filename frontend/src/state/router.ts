import { useEffect, useState } from 'react'
let fallbackPath = '/'
const readPath = () => window.location.hash.slice(1) || fallbackPath
export function navigate(path: string) {
  fallbackPath = path
  try {
    window.location.hash = path
  } catch {
    /* Sandboxed previews can block URL mutation. */
  }
  window.dispatchEvent(new Event('fanatics:navigate'))
}
export function useRoute() {
  const [path, setPath] = useState(readPath)
  useEffect(() => {
    const sync = () => {
      setPath(readPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', sync)
    const localSync = () => {
      setPath(fallbackPath)
      window.scrollTo(0, 0)
    }
    window.addEventListener('fanatics:navigate', localSync)
    return () => {
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('fanatics:navigate', localSync)
    }
  }, [])
  return path.split('?')[0].replace(/\/$/, '') || '/'
}
