import { useState } from 'react'
import { Check, RefreshCcw, Trash2 } from 'lucide-react'
import { actions, useStore } from '../state/store'
import { Modal, PageTitle } from '../components/ui'
import { FPL_ENABLED } from '../features'

export default function Settings() {
  const { profile, leagues } = useStore()
  const [name, setName] = useState(profile.name)
  const [reduced, setReduced] = useState(profile.reducedMotion)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [reset, setReset] = useState(false)
  return (
    <>
      <PageTitle
        kicker="MAKE YOURSELF AT HOME"
        title="Your corner of the court"
        description="A familiar name. A little less motion. Your call."
      />
      <div className="settings-layout">
        <section className="panel">
          <h2>Your local profile</h2>
          <p>This is a browser profile, not an authenticated account.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) {
                setError('Enter a display name.')
                return
              }
              actions.profile(name.trim(), reduced)
              setSaved(true)
              setError('')
            }}
            noValidate
          >
            <label className="field-label">
              Display name
              <input
                maxLength={40}
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSaved(false)
                }}
              />
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={reduced}
                onChange={(e) => {
                  setReduced(e.target.checked)
                  setSaved(false)
                }}
              />
              <span>Reduce animations and stop carousel autoplay</span>
            </label>
            <p className="draft-help">
              Your device’s reduced-motion preference is always respected.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <button className="primary-button">
              Save preferences
              <Check />
            </button>
            {saved && (
              <p className="success-note" role="status">
                Profile saved in this browser.
              </p>
            )}
          </form>
        </section>
        <section className="panel">
          <h2>What’s behind the demo?</h2>
          <p>
            Leagues, picks, queues, squad edits, and preferences are saved in this browser when
            storage is available.
          </p>
          <p>
            Opponents are simulated. Invite codes work locally. Player rankings, team labels, and
            2024/25 stats are sample data.
            {FPL_ENABLED &&
              ' FPL suggestions use an illustrative heuristic, not live ML predictions.'}
          </p>
          <p>Real accounts, multiplayer, and live data will connect to FastAPI later.</p>
          <div className="action-row">
            <button className="danger-button" onClick={() => setReset(true)}>
              <Trash2 size={16} /> Clear local leagues
            </button>
            {leagues.length === 0 && (
              <button className="secondary-button" onClick={actions.restoreDemo}>
                <RefreshCcw />
                Load sample leagues
              </button>
            )}
          </div>
        </section>
      </div>
      {reset && (
        <Modal title="Clear your local leagues?" onClose={() => setReset(false)}>
          <p>
            This removes all {leagues.length} leagues, their draft picks, and queues from this
            browser.{' '}
            {FPL_ENABLED ? 'Your profile and FPL setup will stay.' : 'Your profile will stay.'}
          </p>
          <div className="action-row">
            <button className="secondary-button" onClick={() => setReset(false)}>
              Keep my leagues
            </button>
            <button
              className="danger-button"
              onClick={() => {
                actions.clearLeagues()
                setReset(false)
              }}
            >
              Clear leagues
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
