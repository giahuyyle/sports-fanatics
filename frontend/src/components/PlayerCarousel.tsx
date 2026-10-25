import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { ArrowDownRight, ArrowLeft, ArrowRight, Pause, Play } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { playerById } from '../state/data'
import { useStore } from '../state/store'
import { PlayerPhoto } from './ui'

const slides = [
  {
    id: 1628983,
    number: '02',
    lines: ['SHAI GILGEOUS-', 'ALEXANDER'],
    palette: ['#07659E', '#063C65', '#082B49', '#FFAD70', '#D0E6F4', '#4F91B8'],
  },
  {
    id: 203999,
    number: '15',
    lines: ['NIKOLA', 'JOKIĆ'],
    palette: ['#142B4B', '#102139', '#0C1A2C', '#F4CA67', '#D1DEEF', '#526886'],
  },
  {
    id: 203507,
    number: '34',
    lines: ['GIANNIS', 'ANTETOKOUNMPO'],
    palette: ['#98002E', '#530C22', '#1B1418', '#FFCB66', '#F4D9DB', '#A05160'],
  },
  {
    id: 1629029,
    number: '77',
    lines: ['LUKA', 'DONČIĆ'],
    palette: ['#542D83', '#3A205E', '#291943', '#FFD15F', '#E6D8F6', '#8C70AA'],
  },
  {
    id: 1630162,
    number: '05',
    lines: ['ANTHONY', 'EDWARDS'],
    palette: ['#183B57', '#102A40', '#0B2032', '#BCDF68', '#CCDEE9', '#53778A'],
  },
  {
    id: 201939,
    number: '30',
    lines: ['STEPHEN', 'CURRY'],
    palette: ['#1857A5', '#10396E', '#0C294F', '#FFD65A', '#D1E3FB', '#5B87BE'],
  },
]
export function PlayerCarousel() {
  const { profile } = useStore()
  const reduced = useReducedMotion() || profile.reducedMotion
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [visible, setVisible] = useState(false)
  const [active, setActive] = useState(!document.hidden)
  const ref = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const choose = (next: number) => {
    setIndex((next + slides.length) % slides.length)
    setPaused(true)
  }
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.2,
    })
    observer.observe(ref.current!)
    const visibility = () => setActive(!document.hidden)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])
  useEffect(() => {
    if (reduced || paused || hovered || !visible || !active) return
    const timer = setInterval(() => setIndex((current) => (current + 1) % slides.length), 5000)
    return () => clearInterval(timer)
  }, [reduced, paused, hovered, visible, active])
  const keyboard = (event: KeyboardEvent) => {
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: slides.length - 1 }[
      event.key
    ]
    if (next !== undefined) {
      event.preventDefault()
      choose(next)
    }
  }
  const slide = slides[index],
    player = playerById(slide.id)
  const style = Object.fromEntries(
    ['bg', 'panel', 'chrome', 'accent', 'muted', 'line'].map((key, i) => [
      `--player-${key}`,
      slide.palette[i],
    ]),
  ) as CSSProperties
  return (
    <div
      ref={ref}
      className="hero-poster player-carousel"
      style={style}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured NBA players"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setPaused(true)}
      onKeyDown={keyboard}
    >
      <div className="poster-top">
        <span>NBA FANTASY</span>
        <span>YOUR FIRST PICK AWAITS</span>
      </div>
      <div
        className="carousel-slide-viewport"
        aria-live={paused ? 'polite' : 'off'}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return
          const dx = e.changedTouches[0].clientX - touch.current.x,
            dy = e.changedTouches[0].clientY - touch.current.y
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) choose(index + (dx < 0 ? 1 : -1))
          touch.current = null
        }}
      >
        <motion.div
          key={slide.id}
          initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.24 }}
          role="group"
          aria-roledescription="slide"
          aria-label={`${index + 1} of 6: ${player.name}`}
        >
          <div className="poster-portrait">
            <div className="poster-court" aria-hidden="true">
              <svg viewBox="0 0 520 380" fill="none">
                <path d="M50 0v380M470 0v380M0 190h520M160 0v130h200V0M220 0v55h80V0" />
                <circle cx="260" cy="190" r="75" />
                <path d="M90 0a170 170 0 0 0 340 0" />
              </svg>
            </div>
            <span className="poster-number" aria-hidden="true">
              {slide.number}
            </span>
            <PlayerPhoto key={player.id} player={player} big decorative={false} />
            <span className="poster-position">
              {player.team} / {player.position}
            </span>
          </div>
          <div className="poster-player">
            <div>
              <span className="poster-small-label">A FRANCHISE STARTS WITH A PICK</span>
              <h2>
                {slide.lines[0]}
                <br />
                {slide.lines[1]}
              </h2>
            </div>
            <span className="poster-arrow" aria-hidden="true">
              <ArrowDownRight />
            </span>
          </div>
          <div className="poster-stats">
            {[
              [player.points, 'POINTS'],
              [player.rebounds, 'REBOUNDS'],
              [player.assists, 'ASSISTS'],
            ].map(([value, label]) => (
              <div key={label}>
                <b>{Number(value).toFixed(1)}</b>
                <span>{label}</span>
              </div>
            ))}
            <span className="poster-stat-caption">
              2024/25
              <br />
              SAMPLE STATS
            </span>
          </div>
        </motion.div>
      </div>
      <div className="player-carousel-controls">
        <div className="carousel-arrows">
          <button aria-label="Previous featured NBA player" onClick={() => choose(index - 1)}>
            <ArrowLeft size={18} />
          </button>
          <button aria-label="Next featured NBA player" onClick={() => choose(index + 1)}>
            <ArrowRight size={18} />
          </button>
        </div>
        <div className="carousel-dots" role="group" aria-label="Choose a featured player">
          {slides.map((s, i) => (
            <button
              key={s.id}
              className={i === index ? 'active' : ''}
              aria-label={`Show ${playerById(s.id).name}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => choose(i)}
            >
              <span />
            </button>
          ))}
        </div>
        <span className="carousel-counter">
          0{index + 1}
          <span> / 06</span>
        </span>
        <button
          className="carousel-playback"
          disabled={!!reduced}
          aria-label={
            paused ? 'Resume automatic player rotation' : 'Pause automatic player rotation'
          }
          onClick={() => setPaused(!paused)}
        >
          {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </div>
  )
}
