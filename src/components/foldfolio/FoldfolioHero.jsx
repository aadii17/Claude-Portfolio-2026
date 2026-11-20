import { useSyncExternalStore } from 'react'
import LockScreen from '../site/LockScreen'
import DeskmatGrid, { MAT } from '../site/DeskmatGrid'
import { SITE } from '../site/site'
import Portfolio, { PortfolioNav } from '../portfolio/Portfolio'
import DeskIPod from '../desk/DeskIPod'
import NekoCat from '../desk/NekoCat'
import Foldfolio, { withDefaults } from './Foldfolio'
import { deviceFrame } from './FoldfolioDevice'

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
 *   call            screen shown on the cover after it folds shut again at the end.
 *   nav             floating nav on top of the open display: PortfolioNav (scrolls the screen to a section).
 *   backdrop        the layer behind the phone: the precision-grid desk mat (DeskmatGrid) with the
 *                   iPod lying on it (DeskIPod, src/components/desk/).
 *
 * On top of everything: the pixel cat and its "You like cats?" switch (NekoCat), bottom-left
 * (bottom-right on small screens, where the finish switcher takes the left corner). The cat walks
 * around the phone and the iPod, never over them.
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

const useMedia = (query) =>
  useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )

// the phone's layout, shared with the iPod so it can keep clear of the phone
const SETTINGS = {
  phone: withDefaults({ layout: { top: 32, bottom: 32, maxScale: 1 }, switcher: { bottom: 24 } }),
  wide: withDefaults({ layout: { top: 32, bottom: 32, maxScale: 0.9 }, switcher: { bottom: 24 } }),
}

// the iPod, as set up in the Framer project (no YouTube links = the sample tracks)
const IPOD = {
  theme: 'classic',
  youtubeUrl: '',
  ownerName: SITE.name.split(' ')[0],
  font: { fontFamily: 'var(--font)', fontSize: 10, lineHeight: '1em' },
}

// the cat's corner (the switch, and the cat's home right beside it), kept free of the iPod
const CAT_ZONE = 280
const avoidCatLeft = ({ h }) => [{ x: 0, y: h - 120, w: CAT_ZONE, h: 120 }]
const avoidCatRight = ({ w, h }) => [{ x: w - CAT_ZONE, y: h - 120, w: CAT_ZONE, h: 120 }]

// what the cat walks around: the phone (its whole unfolded area, as the iPod keeps clear of)
// and wherever the iPod is lying right now
const catObstacles = (settings) => () => {
  const w = document.documentElement.clientWidth
  const h = window.innerHeight
  const d = deviceFrame({ w, h }, settings.layout, settings.switcher)
  const out = [{ x: d.left, y: d.top, w: d.width, h: d.height }]
  const ipod = document.querySelector('.desk-ipod')
  if (ipod) {
    const r = ipod.getBoundingClientRect()
    out.push({ x: r.left - 4, y: r.top - 4, w: r.width + 22, h: r.height + 24 }) // + its side and shadow
  }
  return out
}
const OBSTACLES = { phone: catObstacles(SETTINGS.phone), wide: catObstacles(SETTINGS.wide) }

// the cat's home sits on the switch's row, just inside of it (switch: 16px from the corner, ~175 wide)
const CAT_HOME_X = 16 + 176 + 10

export default function FoldfolioHero() {
  const phone = useMedia('(max-width: 809.98px)')
  const compact = useMedia('(max-width: 559.98px)') // the device moves its finish switcher to the left here
  const settings = phone ? SETTINGS.phone : SETTINGS.wide
  const catSide = compact ? 'right' : 'left'

  // Standalone: the phone fills the page (Fold 8 on wide screens, Flip 8 on phones) and opens with
  // the template's curtain intro.
  return (
    <>
      <Foldfolio
        {...settings}
        intro={{ color: MAT, line: 'rgba(255,255,255,.6)' }} // the opening curtain matches the green mat
        screen={<Portfolio variant="fold" />}
        screenPortrait={<Portfolio variant="flip" />}
        cover={<LockScreen size="fold" />}
        coverPortrait={<LockScreen size="flip" />}
        call={<Call />}
        nav={<PortfolioNav />}
        backdrop={
          <>
            <DeskmatGrid />
            <DeskIPod settings={settings} avoid={compact ? avoidCatRight : avoidCatLeft} ipod={IPOD} />
          </>
        }
      />
      <NekoCat
        cat="lucky"
        scale={compact ? 1 : 1.5} // smaller on small screens, where it shares the row with the colour dots
        toggleCorner={`bottom-${catSide}`}
        obstacles={phone ? OBSTACLES.phone : OBSTACLES.wide}
        style={{ position: 'fixed', bottom: compact ? 19 : 11, [catSide]: CAT_HOME_X, zIndex: 30 }}
      />
    </>
  )
}
