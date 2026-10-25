import { useEffect, useState } from 'react'
import { getHealth } from './lib/api'

export default function App() {
  const [apiStatus, setApiStatus] = useState('Connecting to API…')

  useEffect(() => {
    const controller = new AbortController()
    getHealth(controller.signal)
      .then(({ status }) => setApiStatus(status === 'ok' ? 'API connected' : 'API unavailable'))
      .catch(() => {
        if (!controller.signal.aborted) setApiStatus('API offline — start the backend to connect')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-zinc-400">Sports Fanatics</p>
      <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">Your next game starts here.</h1>
      <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
        Draft NBA teams with friends. Make smarter FPL decisions.
      </p>
      <div className="mt-12 grid gap-5 sm:grid-cols-2">
        <section className="rounded-2xl border border-zinc-800 p-7">
          <p className="text-sm font-medium text-orange-400">NBA Fantasy</p>
          <h2 className="mt-3 text-2xl font-semibold">Build your dream roster.</h2>
          <p className="mt-3 leading-relaxed text-zinc-400">Private leagues and live snake drafts with your friends.</p>
          <p className="mt-6 text-sm text-zinc-500">Coming soon</p>
        </section>
        <section className="rounded-2xl border border-zinc-800 p-7">
          <p className="text-sm font-medium text-emerald-400">FPL Assistant</p>
          <h2 className="mt-3 text-2xl font-semibold">Make every transfer count.</h2>
          <p className="mt-3 leading-relaxed text-zinc-400">Player predictions and transfer comparisons for your squad.</p>
          <p className="mt-6 text-sm text-zinc-500">Coming soon</p>
        </section>
      </div>
      <p role="status" className="mt-8 text-sm text-zinc-500">{apiStatus}</p>
    </main>
  )
}
