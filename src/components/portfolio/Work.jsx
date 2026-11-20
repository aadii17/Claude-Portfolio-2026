import { useEffect, useLayoutEffect, useRef } from 'react'
import { goTo } from './store'
import { PROJECTS, SERVICES } from './content'

/* Selected Projects and Services, after the AXIS template's two Home sections.
 *
 * Both are scroll stages: the section is several screens tall and its stage stays pinned to the
 * screen while you scroll through it, the way the template uses position: sticky. The phone's
 * screen moves its content with a transform, not real scrolling, so sticky can't work here:
 * instead the device broadcasts how far the screen has scrolled (`ff:inner`, FoldPhoneDevice.jsx)
 * and each stage pins and animates itself from that. Both halves of the open screen are copies of
 * the page and get the same number, so they stay in step.
 *
 * Projects: SELECTED / PROJECTS slide apart while the first project grows to fill the screen;
 * each next project then rises over the last one, which shrinks back and fades.
 * Services: a headline panel and one card per service, slid sideways as you scroll
 * (on the Flip, simply stacked). Content: PROJECTS and SERVICES in content.js. */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

// run `fn(scrolled)` whenever the screen's content scrolls (and on resize / when fonts land)
function useScreenScroll(fn) {
  const f = useRef(fn)
  f.current = fn
  useEffect(() => {
    const run = () => f.current(window.__ffInner || 0)
    run()
    window.addEventListener('ff:inner', run)
    window.addEventListener('resize', run)
    document.fonts?.ready?.then(run)
    return () => {
      window.removeEventListener('ff:inner', run)
      window.removeEventListener('resize', run)
    }
  }, [])
}

function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden>
      <path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ---------- Selected Projects ---------- */
export function Projects() {
  const sec = useRef(null)
  const stage = useRef(null)
  const words = useRef([])
  const cards = useRef([])
  const N = PROJECTS.length

  useScreenScroll((y) => {
    const s = sec.current
    const st = stage.current
    if (!s || !st) return
    const H = st.offsetHeight
    const W = st.offsetWidth
    const pin = clamp(y - s.offsetTop, 0, s.offsetHeight - H)
    st.style.transform = `translate3d(0, ${pin}px, 0)` // stays on screen while the section scrolls by
    const p = pin / H // 0 → N: one screen of scrolling per step
    const a = easeInOut(clamp(p, 0, 1))
    const [l, r] = words.current
    if (l) l.style.transform = `translate3d(${(-a * W * 0.75).toFixed(1)}px, 0, 0)`
    if (r) r.style.transform = `translate3d(${(a * W * 0.75).toFixed(1)}px, 0, 0)`
    // once the first project fills the screen the words are out of the way: hide them
    for (const w of [l, r]) if (w) w.style.visibility = a >= 0.999 ? 'hidden' : 'visible'
    cards.current.forEach((c, i) => {
      if (!c) return
      // card i comes in during step i (the first one grows, the rest rise from below),
      // and steps back while the next one comes in
      const enter = i === 0 ? a : easeOut(clamp(p - i, 0, 1))
      const out = i < N - 1 ? easeOut(clamp(p - i - 1, 0, 1)) : 0
      const sc = (i === 0 ? Math.max(0.001, enter) : 1) * (1 - 0.5 * out)
      const ty = (i === 0 ? 0 : (1 - enter) * H) - 120 * out
      c.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${sc.toFixed(4)})`
      c.style.opacity = String(+(1 - out).toFixed(3))
      c.style.visibility = (i > 0 && enter <= 0) || out >= 1 ? 'hidden' : 'visible'
    })
  })

  return (
    <section ref={sec} className="pf-section pf-proj" data-pf="projects" aria-label="Selected projects" style={{ '--steps': N + 1 }}>
      <div ref={stage} className="pf-proj-stage">
        <h2 className="pf-proj-title">
          <span ref={(n) => (words.current[0] = n)}>Selected</span>
          <span ref={(n) => (words.current[1] = n)}>Projects</span>
        </h2>
        {PROJECTS.map((p, i) => (
          <article
            key={p.id}
            ref={(n) => (cards.current[i] = n)}
            className="pf-proj-card"
            style={{ '--tint': p.tint, zIndex: i + 1 }}
            aria-label={p.title}
          >
            <span className="pf-proj-mark" aria-hidden>
              {p.mark}
            </span>
            <div className="pf-proj-top">
              <ul className="pf-proj-tags">
                {[p.category, ...p.stack].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <span className="pf-proj-year">{p.year}</span>
            </div>
            <div className="pf-proj-bottom">
              <h3 className="pf-proj-name">{p.title}</h3>
              <p className="pf-proj-sum">{p.summary}</p>
              <span className="pf-proj-arrow">
                <Arrow />
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ---------- Services ---------- */
export function Services({ variant }) {
  const sec = useRef(null)
  const stage = useRef(null)
  const track = useRef(null)
  const sideways = variant === 'fold'

  // Fold: the section is as tall as the sideways distance, so scrolling down slides the row across
  const size = () => {
    const s = sec.current
    const st = stage.current
    const t = track.current
    if (!s || !st || !t) return
    s.style.height = sideways ? `${st.offsetHeight + Math.max(0, t.scrollWidth - st.offsetWidth)}px` : ''
  }
  useLayoutEffect(size)
  useScreenScroll((y) => {
    size()
    if (!sideways) return
    const s = sec.current
    const st = stage.current
    const t = track.current
    if (!s || !st || !t) return
    const run = s.offsetHeight - st.offsetHeight
    const pin = clamp(y - s.offsetTop, 0, run)
    st.style.transform = `translate3d(0, ${pin}px, 0)`
    t.style.transform = `translate3d(${-pin}px, 0, 0)`
  })

  return (
    <section ref={sec} className="pf-section pf-svc" data-pf="services" aria-label="Services">
      <div ref={stage} className="pf-svc-stage">
        <div ref={track} className="pf-svc-track">
          <div className="pf-svc-head">
            <p className="pf-svc-label">
              <span className="pf-svc-tick" aria-hidden />
              {SERVICES.label}
            </p>
            <h2 className="pf-svc-title">{SERVICES.title}</h2>
          </div>
          {SERVICES.items.map((s, i) => (
            <article key={s.title} className="pf-svc-card">
              <div className="pf-svc-visual" style={{ '--tint': PROJECTS[i % PROJECTS.length].tint }} aria-hidden>
                <span>{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="pf-svc-body">
                <ul className="pf-svc-tags">
                  {s.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <h3 className="pf-svc-name">{s.title}</h3>
                <span className="pf-svc-rule" aria-hidden />
                <p className="pf-svc-text">{s.text}</p>
                <a
                  className="pf-svc-cta"
                  href="#contact"
                  onClick={(e) => {
                    e.preventDefault()
                    goTo('contact')
                  }}
                >
                  Let’s talk <Arrow />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
