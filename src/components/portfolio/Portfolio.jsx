import { useEffect, useRef, useState } from 'react'
import '@fontsource-variable/mona-sans'
import '@fontsource-variable/zalando-sans'
import { goTo, store, usePortfolio } from './store'
import { FAQ } from './content'
import { answer } from './answer'
import { SITE } from '../site/site'
import './portfolio.css'

/* The open phone's screen: placeholder sections, each exactly one screen tall
 * (Fold 976 x 916, Flip 358 x 823), so every section fills the display when the nav jumps to it.
 * `variant` picks the size: 'fold' = the Fold's screen, 'flip' = the Flip's screen.
 * Replace a placeholder's contents with the real section when it's ready; keep its data-pf id
 * so the nav still finds it. */

const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'projects', label: 'Work' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
]

/* ---------- Home: the hero, after the Nikola portfolio template's hero ----------
 * Your first name huge and edge to edge, scrolling sideways; your portrait standing in front of it
 * at the bottom; a line about you bottom-left and your social links bottom-right.
 * The portrait is public/hero/portrait.webp, a cut-out with a transparent background; if it's ever
 * missing, a soft silhouette holds its place. */
const PORTRAIT = '/hero/portrait.webp'
const HERO_NAME = `${SITE.name.split(' ')[0]}`
// bottom-left: what you do (after the Asher Vale hero). `level` = how many of the three bars are dark
const SERVICES = [
  { label: 'Web Design', level: 1 },
  { label: 'UI/UX Design', level: 2 },
  { label: 'Product Design', level: 3 },
]
const SOCIALS = [
  {
    label: 'Behance',
    href: SITE.behance,
    icon: (
      <path
        fill="currentColor"
        d="M6.94 4.5c.7 0 1.34.06 1.92.19.58.13 1.07.33 1.49.61.41.28.73.65.96 1.12.22.47.34 1.05.34 1.73 0 .74-.17 1.36-.51 1.86-.34.5-.84.9-1.5 1.22.91.26 1.58.72 2.02 1.37.45.66.67 1.45.67 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-1.16 1.35-.48.35-1.05.6-1.67.77-.61.16-1.25.25-1.91.25H0V4.5h6.94Zm10 12.16c.44.43 1.07.64 1.89.64.59 0 1.1-.15 1.53-.45.42-.29.68-.61.78-.94h2.59c-.4 1.28-1.05 2.2-1.9 2.75-.85.56-1.88.83-3.08.83-.84 0-1.58-.13-2.27-.4-.67-.27-1.24-.65-1.72-1.14-.46-.49-.82-1.08-1.08-1.77-.25-.69-.37-1.45-.37-2.27 0-.8.13-1.54.4-2.23.27-.7.64-1.28 1.12-1.79.5-.51 1.06-.9 1.74-1.19.67-.3 1.4-.44 2.22-.44.91 0 1.69.17 2.38.52.67.34 1.22.82 1.66 1.4.44.59.75 1.26.94 2.02.19.75.25 1.54.21 2.38h-7.69c0 .84.28 1.63.71 2.07Zm-10.24.05c.32 0 .62-.03.91-.09.29-.06.55-.17.76-.3.21-.14.39-.33.52-.58.13-.24.19-.57.19-.96 0-.75-.22-1.29-.64-1.62-.43-.32-.99-.48-1.69-.48H3.24v4.05H6.7Zm13.6-5.65c-.35-.38-.94-.59-1.66-.59-.47 0-.86.07-1.17.24-.3.15-.55.35-.74.59-.19.24-.32.48-.39.75-.08.26-.12.5-.14.71h4.76c-.07-.75-.33-1.3-.68-1.69ZM6.52 10.45c.57 0 1.05-.14 1.42-.41.38-.27.56-.72.56-1.34 0-.34-.07-.62-.18-.85a1.4 1.4 0 0 0-.5-.51 2.1 2.1 0 0 0-.72-.26 4.4 4.4 0 0 0-.84-.07H3.23v3.44h3.29Zm9.1-4.96h5.97v1.45h-5.97V5.49Z"
      />
    ),
  },
  {
    label: 'Instagram',
    href: SITE.instagram,
    icon: (
      <g fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.3" cy="6.7" r=".6" fill="currentColor" stroke="none" />
      </g>
    ),
  },
]

// the name, scrolling sideways forever. Web Animations, not CSS: the phone restyles the screen every
// frame, which keeps restarting CSS animations. Each half of the open screen is its own copy of the
// page, so the animation is pinned to the page clock (startTime 0): both copies stay in step.
function Marquee({ text, speed }) {
  const track = useRef(null)
  useEffect(() => {
    const el = track.current
    if (!el?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const half = el.scrollWidth / 2
    if (!half) return
    const a = el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-half}px)` }], {
      duration: (half / speed) * 1000,
      iterations: Infinity,
    })
    a.startTime = 0
    return () => a.cancel()
  }, [text, speed])
  const items = Array.from({ length: 4 }, (_, i) => (
    <span key={i} className="pf-hero-word" aria-hidden={i > 0}>
      {text}&nbsp;&nbsp;/
    </span>
  ))
  return (
    <div className="pf-hero-marquee">
      <div ref={track} className="pf-hero-track">
        {items}
        {items.map((it, i) => (
          <span key={`b${i}`} className="pf-hero-word" aria-hidden>
            {text}&nbsp;&nbsp;/
          </span>
        ))}
      </div>
    </div>
  )
}

function Portrait() {
  const [missing, setMissing] = useState(false)
  if (missing)
    return (
      <svg className="pf-hero-portrait pf-hero-silhouette" viewBox="0 0 400 400" aria-hidden>
        <defs>
          <linearGradient id="pfSil" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e2e2e2" />
            <stop offset="1" stopColor="#cfcfcf" />
          </linearGradient>
        </defs>
        <circle cx="200" cy="150" r="78" fill="url(#pfSil)" />
        <path d="M44 400c8-96 72-150 156-150s148 54 156 150Z" fill="url(#pfSil)" />
      </svg>
    )
  return <img className="pf-hero-portrait" src={PORTRAIT} alt={SITE.name} onError={() => setMissing(true)} draggable={false} />
}

function Hero({ variant }) {
  return (
    <section className="pf-section pf-hero" data-pf="home" aria-label="Home">
      <h1 className="pf-hero-name">
        <span className="pf-sr">{SITE.name}</span>
        <Marquee text={HERO_NAME} speed={variant === 'flip' ? 36 : 50} />
      </h1>
      <Portrait />
      <div className="pf-hero-row">
        <ul className="pf-hero-services" aria-label="Services">
          {SERVICES.map((s) => (
            <li key={s.label}>
              <span className="pf-bars" aria-hidden>
                {[1, 2, 3].map((b) => (
                  <i key={b} className={b <= s.level ? 'on' : undefined} />
                ))}
              </span>
              {s.label}
            </li>
          ))}
        </ul>
        <ul className="pf-hero-socials">
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="pf-roll">
                {/* two of the icon: on hover the first rolls up and out, the second rolls in */}
                <span className="pf-roll-inner">
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
                    {s.icon}
                  </svg>
                  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
                    {s.icon}
                  </svg>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------- FAQ: "Small talk" ----------
 * The title and a line on the left, the questions on the right as an accordion (one open at a
 * time; the plus turns into a cross), and under them an "ask AI" box: an AI assistant answers
 * questions about you from knowledge.js, and its answer opens under the box like the others.
 * Which question is open lives in the store, so both halves of the open screen agree.
 * Questions and answers: FAQ in content.js. */
const isTouch = () => window.matchMedia('(hover: none), (pointer: coarse)').matches
const gmail = (to, su = '', body = '') =>
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`
// computers: Gmail in a new tab; phones: the phone's own mail app
function sendMail(subject = '', body = '') {
  if (isTouch()) window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  else window.open(gmail(SITE.email, subject, body), '_blank', 'noopener')
}

function ContactAnswer() {
  const tel = SITE.phone.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')
  return (
    <>
      <p>
        Email is best:{' '}
        <a
          href={`mailto:${SITE.email}`}
          onClick={(e) => (e.preventDefault(), sendMail('Hello from your portfolio'))}
        >
          {SITE.email}
        </a>
        . I reply within a day or two.
      </p>
      <p>
        Or call me on <a href={`tel:${SITE.phone}`}>{tel}</a>, or swipe the call that comes in when you fold this phone shut.
      </p>
    </>
  )
}

// the site's favicon (the pixel half-open phone, public/favicon.svg), drawn inline in black: the file
// itself turns white in dark mode, which would vanish on the light row
const FAVICON_D =
  'M14 1h3v1h-3zM6 2h12v1h-12zM3 3h11v1h-11zM15 3h3v1h-3zM2 4h4v1h-4zM15 4h3v1h-3zM19 4h4v1h-4zM2 5h2v1h-2zM13 5h1v1h-1zM15 5h3v1h-3zM19 5h7v1h-7zM2 6h2v1h-2zM5 6h2v1h-2zM13 6h1v1h-1zM15 6h3v1h-3zM19 6h2v1h-2zM23 6h5v1h-5zM2 7h2v1h-2zM5 7h1v1h-1zM15 7h3v1h-3zM19 7h2v1h-2zM26 7h3v1h-3zM2 8h2v1h-2zM15 8h3v1h-3zM19 8h2v1h-2zM26 8h1v1h-1zM28 8h2v1h-2zM2 9h2v1h-2zM15 9h3v1h-3zM19 9h2v1h-2zM28 9h2v1h-2zM2 10h2v1h-2zM15 10h3v1h-3zM19 10h2v1h-2zM28 10h2v1h-2zM2 11h2v1h-2zM15 11h3v1h-3zM19 11h2v1h-2zM28 11h2v1h-2zM2 12h2v1h-2zM15 12h3v1h-3zM19 12h2v1h-2zM28 12h2v1h-2zM2 13h2v1h-2zM15 13h3v1h-3zM19 13h2v1h-2zM28 13h2v1h-2zM2 14h2v1h-2zM15 14h3v1h-3zM19 14h2v1h-2zM28 14h2v1h-2zM2 15h2v1h-2zM15 15h3v1h-3zM19 15h2v1h-2zM28 15h2v1h-2zM2 16h2v1h-2zM15 16h3v1h-3zM19 16h2v1h-2zM28 16h2v1h-2zM2 17h2v1h-2zM15 17h3v1h-3zM19 17h2v1h-2zM28 17h2v1h-2zM2 18h2v1h-2zM15 18h3v1h-3zM19 18h2v1h-2zM28 18h2v1h-2zM2 19h2v1h-2zM15 19h3v1h-3zM19 19h2v1h-2zM28 19h2v1h-2zM2 20h2v1h-2zM15 20h3v1h-3zM19 20h2v1h-2zM28 20h2v1h-2zM2 21h2v1h-2zM15 21h3v1h-3zM19 21h2v1h-2zM28 21h2v1h-2zM2 22h2v1h-2zM15 22h3v1h-3zM19 22h2v1h-2zM28 22h2v1h-2zM2 23h2v1h-2zM15 23h3v1h-3zM19 23h2v1h-2zM28 23h2v1h-2zM2 24h2v1h-2zM15 24h3v1h-3zM19 24h2v1h-2zM28 24h2v1h-2zM2 25h2v1h-2zM15 25h3v1h-3zM19 25h2v1h-2zM26 25h3v1h-3zM2 26h2v1h-2zM15 26h3v1h-3zM19 26h2v1h-2zM23 26h5v1h-5zM2 27h2v1h-2zM15 27h3v1h-3zM19 27h7v1h-7zM2 28h4v1h-4zM15 28h3v1h-3zM19 28h4v1h-4zM3 29h11v1h-11zM15 29h3v1h-3zM6 30h12v1h-12zM14 31h3v1h-3z'
function FavIcon() {
  return (
    <svg className="pf-faq-fav" viewBox="0 0 32 32" width="30" height="30" aria-hidden shapeRendering="crispEdges">
      <path d={FAVICON_D} fill="currentColor" />
    </svg>
  )
}

/* Ask AI: the question is answered from knowledge.js (and the FAQ's own questions), matched word
 * by word in the browser by answer.js. No AI, no server, nothing saved. The answer shows under the
 * input like an opened FAQ answer, and the next question replaces it. The current answer lives in
 * the store (store.ai) only so both halves of the open screen show the same thing. */
const THINK_MS = 450 // a short "Thinking…" so an instant answer doesn't feel abrupt
function askAI(question) {
  store.set({ faq: null, ai: { q: question, a: '', error: false, loading: true } }) // close any open FAQ question
  setTimeout(() => {
    if (store.get().ai.q !== question) return // a newer question (or a close) since
    store.set({ ai: { q: question, a: answer(question), error: false, loading: false } })
  }, THINK_MS)
}

function Thinking() {
  const el = useRef(null)
  useEffect(() => {
    const n = el.current
    if (!n?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Web Animations: the phone's per-frame restyling keeps restarting CSS animations
    const a = n.animate([{ opacity: 0.35 }, { opacity: 1 }, { opacity: 0.35 }], { duration: 1200, iterations: Infinity })
    return () => a.cancel()
  }, [])
  return (
    <p ref={el} className="pf-ai-thinking">
      Thinking…
    </p>
  )
}

// the answer, styled as an opened FAQ item: the question as its title, a cross to close it
function AiAnswer() {
  const { ai } = usePortfolio()
  if (!ai.q) return null
  return (
    <div className="pf-faq-item is-open pf-ai-answer" aria-live="polite">
      <div className="pf-faq-q">
        <span>{ai.q}</span>
        <button
          type="button"
          className="pf-ai-close"
          aria-label="Close answer"
          onClick={() => store.set({ ai: { q: '', a: '', error: false, loading: false } })}
        >
          <svg className="pf-faq-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
            <path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="pf-faq-a">
        <div className="pf-faq-a-inner">{ai.loading ? <Thinking /> : <p className={ai.error ? 'pf-ai-error' : undefined}>{ai.a}</p>}</div>
      </div>
    </div>
  )
}

function AskAI() {
  const [q, setQ] = useState('')
  const send = (e) => {
    e.preventDefault()
    const question = q.trim()
    if (!question) return
    setQ('')
    askAI(question)
  }
  return (
    <form className="pf-faq-ask" onSubmit={send}>
      <FavIcon />
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={FAQ.ask}
        aria-label={FAQ.ask}
        enterKeyHint="send"
        maxLength={500}
      />
      <button type="submit" aria-label="Send" disabled={!q.trim()}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
          <path d="M12 19V5m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  )
}

function Faq() {
  const { faq: open } = usePortfolio()
  return (
    <section className="pf-section pf-faq" data-pf="faq" aria-label="FAQ">
      <div className="pf-faq-head">
        <h2 className="pf-faq-title">{FAQ.title}</h2>
        <p className="pf-faq-intro">{FAQ.intro}</p>
      </div>
      <div className="pf-faq-list">
        {FAQ.items.map((it) => {
          const on = open === it.id
          return (
            <div key={it.id} className={`pf-faq-item${on ? ' is-open' : ''}`}>
              <button
                type="button"
                className="pf-faq-q"
                aria-expanded={on}
                aria-controls={`pf-faq-${it.id}`}
                onClick={() => store.set({ faq: on ? null : it.id })}
              >
                <span>{it.q}</span>
                <svg className="pf-faq-icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden>
                  <path d="M12 4v16M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              {/* 0fr -> 1fr: the answer opens to its own height */}
              <div className="pf-faq-a" id={`pf-faq-${it.id}`} role="region" aria-hidden={!on}>
                <div className="pf-faq-a-inner">
                  {it.contact ? <ContactAnswer /> : it.a.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            </div>
          )
        })}
        <AskAI />
        <AiAnswer />
      </div>
    </section>
  )
}

function Placeholder({ id, label, n }) {
  return (
    <section className="pf-section" data-pf={id} aria-label={label}>
      <div className="pf-ph">
        <span className="pf-ph-n">
          {String(n).padStart(2, '0')} / {String(SECTIONS.length).padStart(2, '0')}
        </span>
        <h2 className="pf-ph-title">{label}</h2>
        <p className="pf-ph-note">Section placeholder</p>
      </div>
    </section>
  )
}

/* The floating pill on top of the open screen (FoldPhone's `nav` slot). */
export function PortfolioNav() {
  const { active } = usePortfolio()
  return (
    <nav className="pf-nav" aria-label="Sections">
      {SECTIONS.map((s) => (
        <button key={s.id} type="button" aria-current={active === s.id ? 'true' : undefined} onClick={() => goTo(s.id)}>
          {s.label}
        </button>
      ))}
    </nav>
  )
}

export default function Portfolio({ variant }) {
  return (
    <div className={`pf pf-${variant}`}>
      {SECTIONS.map((s, i) =>
        s.id === 'home' ? (
          <Hero key={s.id} variant={variant} />
        ) : s.id === 'faq' ? (
          <Faq key={s.id} />
        ) : (
          <Placeholder key={s.id} {...s} n={i + 1} />
        ),
      )}
    </div>
  )
}
