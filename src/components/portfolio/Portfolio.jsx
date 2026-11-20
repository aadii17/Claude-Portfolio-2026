import { goTo, usePortfolio } from './store'
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
  { id: 'contact', label: 'Contact' },
]

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
      {SECTIONS.map((s, i) => (
        <Placeholder key={s.id} {...s} n={i + 1} />
      ))}
    </div>
  )
}
