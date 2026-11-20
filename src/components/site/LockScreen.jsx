import { useIndiaTime } from './indiaTime'
import { NOTICES, SITE } from './site'

/* The closed phone's cover screen, rebuilt from Foldfolio's own lock screen ("Slot · Cover" and
 * "Slot · Cover Phone" in the Foldfolio template): photo wallpaper (public/wallpaper.jpg, set in
 * index.css), big condensed clock, one line under it, frosted notifications, round buttons +
 * "Scroll to unfold". Sizes are the template's; the clock is live India time. */

// the template's two variants: Fold cover (476 wide) and Flip FlexWindow (358 wide)
const SPEC = {
  fold: { pad: '54px 24px 26px', gap: 6, clock: 132, button: 48, hint: '9px 14px', footerTop: 18, notices: 2 },
  flip: { pad: '24px 16px 14px', gap: 4, clock: 76, button: 40, hint: '8px 12px', footerTop: 10, notices: 1 },
}

const INK = 'rgb(17,17,17)'
const tiles = ['linear-gradient(135deg,#9fb8c8,#56788a)', 'linear-gradient(135deg,#d9c7b0,#9a8466)']

// Behance "Bē" wordmark
const BehanceIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={INK} aria-hidden>
    <path d="M8.2 11.4c.9-.4 1.6-1.2 1.6-2.5 0-2.3-1.7-2.9-3.7-2.9H1v12h5.3c2.1 0 4-.9 4-3.3 0-1.5-.7-2.7-2.1-3.3ZM3.4 8.1h2.4c.9 0 1.6.3 1.6 1.2 0 .9-.6 1.3-1.5 1.3H3.4V8.1Zm2.7 7.8H3.4v-3.1h2.8c1.1 0 1.7.5 1.7 1.6 0 1.1-.8 1.5-1.8 1.5ZM15.4 7h5.3v1.3h-5.3V7Zm2.7 2.3c-2.8 0-4.6 2-4.6 4.5 0 2.7 1.7 4.5 4.6 4.5 2.1 0 3.6-1 4.2-3h-2.2c-.2.7-1 1.1-1.9 1.1-1.4 0-2.1-.8-2.1-2.1h6.4c.1-2.7-1.3-5-4.4-5Zm-2 3.6c.1-1.1.8-1.8 1.9-1.8 1.1 0 1.7.7 1.8 1.8h-3.7Z" />
  </svg>
)
// Instagram glyph: rounded square, lens, flash dot
const InstagramIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={INK} strokeWidth="1.8" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="5.5" />
    <circle cx="12" cy="12" r="4.2" />
    <circle cx="17.4" cy="6.6" r="1.1" fill={INK} stroke="none" />
  </svg>
)

export default function LockScreen({ size }) {
  const s = SPEC[size]
  const time = useIndiaTime()
  const round = (extra) => ({
    width: s.button, height: s.button, borderRadius: '50%', flex: 'none',
    display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,.86)', ...extra,
  })

  return (
    <div className={`lock lock-${size}`} style={{ padding: s.pad, gap: s.gap }}>
      <time className="lock-clock" style={{ fontSize: s.clock }} aria-label={`India time ${time}`}>{time}</time>
      <p className="lock-line">{SITE.role}</p>

      <div className="lock-spacer" />

      <div className="lock-notices">
        {NOTICES.slice(0, s.notices).map((n, i) => (
          <div className="lock-notice" key={n.title}>
            <span className="lock-thumb" style={n.image ? { backgroundImage: `url(${n.image})` } : { background: tiles[i % tiles.length] }} />
            <span className="lock-notice-text">
              <span className="lock-line">{n.title}</span>
              <span className="lock-meta">{n.meta}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="lock-footer" style={{ paddingTop: s.footerTop }}>
        <a href={SITE.behance} target="_blank" rel="noreferrer" aria-label="Behance" style={round()}>
          <BehanceIcon />
        </a>
        <span className="lock-line lock-hint" style={{ padding: s.hint }}>Scroll to unfold</span>
        <a href={SITE.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" style={round()}>
          <InstagramIcon />
        </a>
      </div>
    </div>
  )
}
