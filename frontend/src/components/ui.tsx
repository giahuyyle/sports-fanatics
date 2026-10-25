import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { initials } from '../state/data'
import { navigate } from '../state/router'
import type { Player } from '../state/types'

export function Brand({ landing = false }: { landing?: boolean }) {
  return (
    <button
      className={landing ? 'landing-brand' : 'brand'}
      onClick={() => navigate('/')}
      aria-label="Sports Fanatics home"
    >
      <span className={landing ? 'landing-brand-symbol' : 'brand-symbol'}>
        <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
          <path fill="currentColor" d="M8 5h24l-4 7H13l-3 5h13l-4 7H6l-4 7H0l7-13H4l7-13Z" />
          <path fill="currentColor" d="M22 27h10l-3 5H19z" />
        </svg>
      </span>
      <span>
        SPORTS
        <br />
        FANATICS<span className="orange">.</span>
      </span>
    </button>
  )
}
export function Avatar({
  name,
  small = false,
  index = 0,
}: {
  name: string
  small?: boolean
  index?: number
}) {
  return (
    <span
      className={`avatar ${small ? 'small' : ''}`}
      style={
        { '--avatar': ['#eb8c52', '#a2b9c1', '#b3a3c6', '#8fae96'][index % 4] } as CSSProperties
      }
    >
      {initials(name)}
    </span>
  )
}
export function PlayerPhoto({
  player,
  big = false,
  decorative = true,
}: {
  player: Player
  big?: boolean
  decorative?: boolean
}) {
  const [failed, setFailed] = useState(false)
  return player.image && !failed ? (
    <img
      className={`player-photo ${big ? 'big' : ''}`}
      src={`/assets/players/${player.id}.png`}
      width="520"
      height="380"
      alt={decorative ? '' : player.name}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      className={`photo-fallback ${big ? 'big' : ''}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : player.name}
    >
      {initials(player.name)}
    </span>
  )
}
export function PageTitle({
  kicker,
  title,
  description,
  children,
  green = false,
}: {
  kicker: string
  title: string
  description?: string
  children?: ReactNode
  green?: boolean
}) {
  return (
    <div className="page-title">
      <div>
        <span className={`eyebrow ${green ? 'green' : 'orange'}`}>{kicker}</span>
        <h1>
          {title}
          <span className={green ? 'green' : 'orange'}>.</span>
        </h1>
        {description && <p>{description}</p>}
      </div>
      <div className="title-actions">{children}</div>
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    return () => {
      dialog.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const rect = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-header">
        <span className="eyebrow">SPORTS FANATICS</span>
        <button className="icon-button" onClick={onClose} aria-label="Close dialog">
          <X />
        </button>
      </div>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </dialog>
  )
}
export function EmptyState({
  title,
  description,
  children,
  page = false,
}: {
  title: string
  description: string
  children?: ReactNode
  page?: boolean
}) {
  const Heading = page ? 'h1' : 'h2'
  return (
    <section className="panel empty-state">
      <span className="eyebrow orange">YOUR NEXT CHAPTER</span>
      <Heading>{title}</Heading>
      <p>{description}</p>
      <div className="action-row">{children}</div>
    </section>
  )
}
export function RouteButton({
  to,
  children,
  secondary = false,
}: {
  to: string
  children: ReactNode
  secondary?: boolean
}) {
  return (
    <button
      className={secondary ? 'secondary-button' : 'primary-button'}
      onClick={() => navigate(to)}
    >
      {children}
      {!secondary && <ArrowRight size={18} />}
    </button>
  )
}
