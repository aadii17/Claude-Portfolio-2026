import { useEffect, useRef, useSyncExternalStore } from 'react'
import { SITE } from './site'
import './call.css'

/* The incoming call on the cover, after the phone folds shut at the end (after the Foldfolio
 * template's call screen): your photo dimmed behind, your name, an avatar, and "slide to talk".
 * Drag the green knob to the end (or just tap the pill): on a phone it calls you (SITE.phone),
 * on a computer it emails you (SITE.email).
 * One component for both phones: the Flip's small outer screen gets the compact layout through a
 * container query (call.css). */

const PORTRAIT = '/hero/portrait.webp' // the avatar
const CALL_BG = '/hero/call-bg.webp' // the photo behind everything (the desert road)

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2Z"
      />
    </svg>
  )
}

function SlideToTalk({ href, newTab }) {
  const track = useRef(null)
  const knob = useRef(null)
  const drag = useRef(null)
  const label = useRef(null)
  useEffect(() => {
    const el = label.current
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const a = el.animate([{ backgroundPosition: '100% 0' }, { backgroundPosition: '-50% 0' }], { duration: 2400, iterations: Infinity })
    return () => a.cancel()
  }, [])

  const down = (e) => {
    if (e.button > 0) return
    const t = track.current.getBoundingClientRect()
    const k = knob.current.getBoundingClientRect()
    const scale = t.width / track.current.offsetWidth || 1 // the phone is drawn scaled
    drag.current = { x0: e.clientX, x: 0, max: (t.width - k.width - 2 * (k.left - t.left)) / scale, scale, moved: false }
    knob.current.style.transition = ''
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    d.x = Math.max(0, Math.min(d.max, (e.clientX - d.x0) / d.scale))
    if (d.x > 3) d.moved = true
    knob.current.style.transform = `translateX(${d.x}px)`
    track.current.style.setProperty('--slid', String(d.x / d.max))
  }
  // let go: past 80% it connects (opens the email), otherwise the knob springs back.
  // A cancelled gesture (the browser took over) always springs back.
  const up = (e) => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const done = e.type === 'pointerup' && d.x > d.max * 0.8
    knob.current.style.transition = 'transform .35s cubic-bezier(.2,.8,.2,1)'
    knob.current.style.transform = done ? `translateX(${d.max}px)` : 'translateX(0)'
    track.current.style.setProperty('--slid', done ? '1' : '0')
    setTimeout(() => {
      if (!knob.current) return
      knob.current.style.transition = ''
      if (done) {
        knob.current.style.transform = 'translateX(0)'
        track.current.style.setProperty('--slid', '0')
      }
    }, done ? 900 : 360)
    if (done) newTab ? window.open(href, '_blank', 'noopener') : (window.location.href = href)
    d.moved && e.preventDefault()
    track.current.dataset.dragged = d.moved ? '1' : ''
  }

  return (
    <a
      ref={track}
      className="call-slide"
      href={href}
      {...(newTab ? { target: '_blank', rel: 'noreferrer' } : null)}
      // a link is natively draggable, and that native drag cancels the swipe after a few pixels
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onClick={(e) => {
        // a drag already decided what to do; a plain tap just follows the link
        if (track.current.dataset.dragged) (e.preventDefault(), (track.current.dataset.dragged = ''))
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      <span ref={knob} className="call-knob">
        <PhoneIcon />
      </span>
      <span ref={label} className="call-slide-label">slide to talk</span>
    </a>
  )
}

// phones and tablets (touch, no cursor) can place a call; computers get the email instead
const TOUCH = '(hover: none), (pointer: coarse)'
const useTouch = () =>
  useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(TOUCH)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(TOUCH).matches,
    () => false,
  )

// computers: a Gmail compose window in a new tab (a mailto: link would open whatever mail app the
// visitor's computer has set up, often Outlook)
const gmail = (to) => `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}`

export default function CallScreen() {
  const mail = gmail(SITE.email)
  const call = useTouch() && SITE.phone
  const talk = call ? `tel:${SITE.phone}` : mail
  return (
    <div className="call">
      <img className="call-bg" src={CALL_BG} alt="" draggable={false} />
      <div className="call-ui">
        <h3 className="call-name">{SITE.name}</h3>
        <p className="call-sub">Incoming call · about your next project</p>
        <div className="call-avatar">
          <img src={PORTRAIT} alt="" draggable={false} />
        </div>
        <div className="call-fill" />
        <SlideToTalk href={talk} newTab={!call} />
        <a className="call-mail" href={mail} target="_blank" rel="noreferrer">
          {SITE.email}
        </a>
      </div>
    </div>
  )
}
