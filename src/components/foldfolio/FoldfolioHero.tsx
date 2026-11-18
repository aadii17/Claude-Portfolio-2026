import { useSyncExternalStore } from 'react'
import LockScreen from '../site/LockScreen'
import DeskmatGrid from '../site/DeskmatGrid'
import Portfolio, { PortfolioNav } from '../portfolio/Portfolio'
import Foldfolio from './Foldfolio'

/* The Foldfolio device. The open screen holds the single-page portfolio (src/components/portfolio/).
 *
 * Devices: wide screens show a Galaxy Z Fold 8 (book fold), phones/tall screens a Galaxy Z Flip 8 (flip fold).
 *
 * Slots (each takes ONE element; the device sets its width, you set its height):
 *   screen          Z Fold 8 inner display: Portfolio (fold). 976px wide; 916px visible, taller = it scrolls inside.
 *                   A faint under-display camera sits top-centre of the right half.
 *   screenPortrait  Z Flip 8 inner display: Portfolio (flip). 358px wide; 823px visible. Punch-hole at top centre.
 *   cover           Z Fold 8 cover screen (closed): LockScreen, Foldfolio's own lock-screen design. Punch-hole at top centre.
 *   coverPortrait   Z Flip 8 FlexWindow (closed): LockScreen, compact variant.
 *   status.live     the status-bar clock shows live India time (same clock as the lock screen).
 *   call            screen shown on the cover after it folds shut again at the end.
 *   nav             floating nav on top of the open display: PortfolioNav (scrolls the screen to a section).
 *   backdrop        the layer behind the phone: the precision-grid desk mat (DeskmatGrid).
 */

function Call() {
  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#fff', background: '#0b0b0b', fontFamily: 'var(--font)' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 30, fontWeight: 700 }}>Incoming call</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>call screen placeholder</div>
      </div>
    </div>
  )
}

// Basic is the only background now (the Basic / Glow / Orbit switch is hidden), so drop a
// Glow or Orbit choice a visitor may have saved earlier. The frame colour they picked is kept.
try {
  const KEY = 'foldfolio:style'
  const saved = JSON.parse(localStorage.getItem(KEY) || '{}')
  if (saved.scene && saved.scene !== 'split') {
    delete saved.scene
    localStorage.setItem(KEY, JSON.stringify(saved))
  }
} catch {
  /* storage unavailable: nothing saved to clean up */
}

const PHONE_QUERY = '(max-width: 809.98px)'
const subscribe = (cb: () => void) => {
  const mq = window.matchMedia(PHONE_QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
const isPhone = () => window.matchMedia(PHONE_QUERY).matches

export default function FoldfolioHero() {
  const phone = useSyncExternalStore(subscribe, isPhone, () => false)
  // Standalone: the phone fills the page (Fold 8 on wide screens, Flip 8 on phones) and opens with
  // the template's curtain intro.
  return (
    <Foldfolio
      mode="fold"
      scene="split"
      basicTone="tint"
      intro={{ on: true }}
      layout={{ top: 32, bottom: 32, maxScale: phone ? 1 : 0.9 }}
      switcher={{ show: true, scenesAt: 'header', bottom: 24 }}
      screen={<Portfolio variant="fold" />}
      screenPortrait={<Portfolio variant="flip" />}
      status={{ live: true }}
      cover={<LockScreen size="fold" />}
      coverPortrait={<LockScreen size="flip" />}
      call={<Call />}
      nav={<PortfolioNav />}
      backdrop={<DeskmatGrid />}
    />
  )
}
