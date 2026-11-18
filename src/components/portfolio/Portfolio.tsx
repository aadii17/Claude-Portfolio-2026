import { useId, useMemo, type FormEvent } from 'react'
import { ABOUT, FAQ, HERO, PROFILE, PROJECTS, SOCIALS, STATEMENT, type Project } from './content'
import { goTo, store, useTick, usePortfolio, type Form, type FormErrors } from './store'
import './portfolio.css'

/* The single-page portfolio shown on the open phone's screen (inspired by adamperlis.com).
 * Sections: Hero, About, Statement, Projects (filter + search), FAQ, Contact, Footer.
 * `variant` picks the layout: 'fold' = the Fold's 976px screen, 'flip' = the Flip's 358px screen.
 * Content lives in content.ts; shared interactive state in store.ts. */

type Variant = 'fold' | 'flip'
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 1. Hero ---------- */
function Hero() {
  const t = useTick(!reduceMotion())
  const i = t % HERO.words.length
  return (
    <section className="pf-hero" data-pf="home">
      <div className="pf-hero-id">
        <img className="pf-avatar" src={PROFILE.photo} alt="" width={105} height={106} />
        <span className="pf-at">
          {PROFILE.role} at <img src={PROFILE.company.logo} alt={PROFILE.company.name} />
        </span>
      </div>
      <h1 className="pf-hero-title">
        <span className="pf-hi">Hi, I’m {PROFILE.first}.</span> {HERO.lead}{' '}
        <span className="pf-word" aria-live="off">
          {HERO.words.map((w, k) => (
            <span key={w} className={k === i ? 'is-on' : undefined} aria-hidden={k !== i}>
              {w}
            </span>
          ))}
        </span>
      </h1>
      <p className="pf-hero-sub">{HERO.sub}</p>
      <div className="pf-actions">
        <button type="button" className="pf-btn pf-btn-fill" onClick={() => goTo('projects')}>
          See projects
        </button>
        {PROFILE.resume && (
          <a className="pf-btn pf-btn-line" href={PROFILE.resume} download>
            Download resume
          </a>
        )}
      </div>
    </section>
  )
}

/* ---------- 2. About ---------- */
function Chips({ items }: { items: string[] }) {
  return (
    <ul className="pf-chips">
      {items.map((s) => (
        <li key={s}>{s}</li>
      ))}
    </ul>
  )
}

function About() {
  return (
    <section className="pf-section pf-about" data-pf="about">
      <h2 className="pf-h2">About</h2>
      <div className="pf-about-grid">
        <div className="pf-about-bio">
          {ABOUT.bio.map((p) => (
            <p key={p.slice(0, 20)}>{p}</p>
          ))}
          <dl className="pf-exp">
            {ABOUT.experience.map((e) => (
              <div key={e.org}>
                <dt>{e.org}</dt>
                <dd>
                  {e.role} <span>{e.when}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="pf-about-lists">
          <h3 className="pf-h3">Skills</h3>
          <Chips items={ABOUT.skills} />
          <h3 className="pf-h3">Tools</h3>
          <Chips items={ABOUT.tools} />
          <h3 className="pf-h3">Outside work</h3>
          <Chips items={ABOUT.interests} />
        </div>
      </div>
    </section>
  )
}

/* ---------- 3. Statement ---------- */
function Statement() {
  return (
    <section className="pf-statement" data-pf="statement">
      <h2 className="pf-statement-title">{STATEMENT.headline}</h2>
      <p>{STATEMENT.body}</p>
      <button type="button" className="pf-btn pf-btn-light" onClick={() => goTo('contact')}>
        {STATEMENT.cta}
      </button>
    </section>
  )
}

/* ---------- 4. Projects ---------- */
const CATEGORIES = ['All', ...Array.from(new Set(PROJECTS.map((p) => p.category)))]

function Card({ p }: { p: Project }) {
  return (
    <article className="pf-card">
      <div className="pf-card-cover" style={p.image ? { backgroundImage: `url(${p.image})` } : { background: p.tint }}>
        {!p.image && <span aria-hidden>{p.mark}</span>}
      </div>
      <div className="pf-card-body">
        <div className="pf-card-meta">
          <span>{p.category}</span>
          <span>{p.year}</span>
        </div>
        <h3 className="pf-card-title">{p.title}</h3>
        <p className="pf-card-text">{p.summary}</p>
        <ul className="pf-stack" aria-label="Tools">
          {p.stack.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
        {p.link ? (
          <a className="pf-link" href={p.link.href} target="_blank" rel="noreferrer">
            {p.link.label}
          </a>
        ) : (
          <span className="pf-link is-soon">Case study coming soon</span>
        )}
      </div>
    </article>
  )
}

function Projects() {
  const { query, filter } = usePortfolio()
  const searchId = useId()
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PROJECTS.filter(
      (p) =>
        (filter === 'All' || p.category === filter) &&
        (!q || [p.title, p.summary, p.category, ...p.stack].some((s) => s.toLowerCase().includes(q))),
    )
  }, [query, filter])

  return (
    <section className="pf-section pf-projects" data-pf="projects">
      <h2 className="pf-h2">Projects</h2>
      <div className="pf-tools">
        <div className="pf-filters" role="group" aria-label="Filter by category">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className="pf-filter" aria-pressed={filter === c} onClick={() => store.set({ filter: c })}>
              {c}
            </button>
          ))}
        </div>
        <div className="pf-search">
          <label htmlFor={searchId}>Search projects</label>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Try “dashboards” or “Figma”"
            onChange={(e) => store.set({ query: e.target.value })}
          />
        </div>
      </div>
      <p className="pf-count" aria-live="polite">
        {list.length} {list.length === 1 ? 'project' : 'projects'}
      </p>
      {list.length ? (
        <div className="pf-grid">
          {list.map((p) => (
            <Card key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <div className="pf-empty">
          <p>Nothing matches that yet.</p>
          <button type="button" className="pf-btn pf-btn-line" onClick={() => store.set({ query: '', filter: 'All' })}>
            Clear filters
          </button>
        </div>
      )}
    </section>
  )
}

/* ---------- 5. FAQ ---------- */
function Faq() {
  const { open } = usePortfolio()
  const base = useId()
  return (
    <section className="pf-section pf-faq" data-pf="faq">
      <h2 className="pf-h2">Questions</h2>
      <div className="pf-faq-list">
        {FAQ.map((f) => {
          const on = !!open[f.id]
          const panel = `${base}-${f.id}`
          return (
            <div className={`pf-faq-item${on ? ' is-open' : ''}`} key={f.id}>
              <h3>
                <button
                  type="button"
                  aria-expanded={on}
                  aria-controls={panel}
                  onClick={() => store.set((s) => ({ open: { ...s.open, [f.id]: !on } }))}
                >
                  {f.q}
                  <span className="pf-faq-icon" aria-hidden />
                </button>
              </h3>
              <div className="pf-faq-panel" id={panel} role="region" aria-hidden={!on}>
                <div>
                  <p>{f.a}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ---------- 6. Contact ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(f: Form): FormErrors {
  const e: FormErrors = {}
  if (!f.name.trim()) e.name = 'Please add your name.'
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Please add an email I can reply to.'
  if (f.message.trim().length < 10) e.message = 'A sentence or two about your project helps.'
  return e
}

function Field({ k, label, type = 'text', multiline }: { k: keyof Form; label: string; type?: string; multiline?: boolean }) {
  const { form, errors } = usePortfolio()
  const id = useId()
  const err = errors[k]
  const common = {
    id,
    value: form[k],
    'aria-invalid': err ? true : undefined,
    'aria-describedby': err ? `${id}-err` : undefined,
    onChange: (e: { target: { value: string } }) =>
      store.set((s) => ({ form: { ...s.form, [k]: e.target.value }, errors: { ...s.errors, [k]: undefined }, sent: false })),
  }
  return (
    <div className="pf-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea rows={4} {...common} /> : <input type={type} autoComplete={k === 'name' ? 'name' : k} {...common} />}
      {err && (
        <p className="pf-error" id={`${id}-err`}>
          {err}
        </p>
      )}
    </div>
  )
}

function Contact() {
  const { form, sent } = usePortfolio()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const errors = validate(form)
    store.set({ errors })
    if (Object.keys(errors).length) return
    // no server: the message opens in the visitor's email app, addressed to you
    const body = `${form.message}\n\n${form.name} (${form.email})`
    window.location.href = `mailto:${PROFILE.email}?subject=${encodeURIComponent(`Project enquiry from ${form.name}`)}&body=${encodeURIComponent(body)}`
    store.set({ sent: true })
  }
  return (
    <section className="pf-section pf-contact" data-pf="contact">
      <div className="pf-contact-intro">
        <h2 className="pf-h2">Let’s build something useful.</h2>
        <p>Tell me what you are making and where you are stuck. I usually reply within two working days.</p>
        <ul className="pf-socials">
          <li>
            <a href={`mailto:${PROFILE.email}`}>{PROFILE.email}</a>
          </li>
          {SOCIALS.map((s) => (
            <li key={s.label}>
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
      <form className="pf-form" onSubmit={submit} noValidate>
        <Field k="name" label="Name" />
        <Field k="email" label="Email" type="email" />
        <Field k="message" label="Project details" multiline />
        <button type="submit" className="pf-btn pf-btn-fill">Send message</button>
        <p className="pf-form-note" aria-live="polite">
          {sent ? 'Your email app should open with the message ready to send.' : 'Sending opens your email app with the message filled in.'}
        </p>
      </form>
    </section>
  )
}

/* ---------- 7. Footer ---------- */
const NAV = [
  { id: 'home', label: 'Home' },
  { id: 'projects', label: 'Work' },
  { id: 'about', label: 'About' },
  { id: 'contact', label: 'Contact' },
]

function Footer() {
  return (
    <footer className="pf-footer">
      <p>© 2026 {PROFILE.name}</p>
      <nav aria-label="Footer">
        {[...NAV.slice(1), { id: 'faq', label: 'FAQ' }].map((n) => (
          <button key={n.id} type="button" onClick={() => goTo(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
    </footer>
  )
}

/* The floating pill on top of the open screen (Foldfolio's `nav` slot). */
export function PortfolioNav() {
  const { active } = usePortfolio()
  return (
    <nav className="pf-nav" aria-label="Sections">
      {NAV.map((n) => (
        <button key={n.id} type="button" aria-current={active === n.id ? 'true' : undefined} onClick={() => goTo(n.id)}>
          {n.label}
        </button>
      ))}
    </nav>
  )
}

export default function Portfolio({ variant }: { variant: Variant }) {
  return (
    <div className={`pf pf-${variant}`}>
      <Hero />
      <About />
      <Statement />
      <Projects />
      <Faq />
      <Contact />
      <Footer />
    </div>
  )
}
