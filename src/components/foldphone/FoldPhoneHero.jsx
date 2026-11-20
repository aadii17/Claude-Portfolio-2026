import { useSyncExternalStore } from 'react'
import LockScreen from '../site/LockScreen'
import DeskmatGrid, { MAT } from '../site/DeskmatGrid'
import SheetLabels from '../site/TitleBlock'
import { SITE } from '../site/site'
import Portfolio, { PortfolioNav } from '../portfolio/Portfolio'
import DeskIPod from '../desk/DeskIPod'
import NekoCat from '../desk/NekoCat'
import SiteLoader from '../site/SiteLoader'
import FoldPhone, { withDefaults } from './FoldPhone'
import { deviceFrame } from './FoldPhoneDevice'

/* The FoldPhone device. The open screen holds the single-page portfolio (src/components/portfolio/).
 *
 * Devices: wide screens show a Galaxy Z Fold 8 (book fold), phones/tall screens a Galaxy Z Flip 8 (flip fold).
 *
 * Slots (each takes ONE element; the device sets its width, you set its height):
 *   screen          Z Fold 8 inner display: Portfolio (fold). 976px wide; 916px visible, taller = it scrolls inside.
 *                   A faint under-display camera sits top-centre of the right half.
 *   screenPortrait  Z Flip 8 inner display: Portfolio (flip). 358px wide; 823px visible. Punch-hole at top centre.
 *   cover           Z Fold 8 cover screen (closed): LockScreen, FoldPhone's own lock-screen design. Punch-hole at top centre.
 *   coverPortrait   Z Flip 8 FlexWindow (closed): LockScreen, compact variant.
 *   call            screen shown on the cover after it folds shut again at the end.
 *   nav             floating nav on top of the open display: PortfolioNav (scrolls the screen to a section).
 *   backdrop        the layer behind the phone: the precision-grid desk mat (DeskmatGrid) with the
 *                   iPod lying on it (DeskIPod, src/components/desk/; wider screens only, not on mobile).
 *
 * On top of everything: the pixel cat and its "You like cats?" switch (NekoCat), bottom-left
 * (bottom-right on small screens, where the finish switcher takes the left corner). The cat walks
 * around the phone and the iPod, never over them. On touch screens (no cursor) there's no switch:
 * the cat sits in that corner and goes through its moods by itself.
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

// small phones: how far up the colour dots' row sits (the copyright line goes under it: index.css)
const COMPACT_ROW = 40

// the phone's layout, shared with the iPod so it can keep clear of the phone
const SETTINGS = {
  // phones: the phone starts below the name block (name, role and copyright), so even unfolded it
  // never covers them
  phone: withDefaults({ layout: { top: 104, bottom: 32, maxScale: 1 }, switcher: { bottom: 24 } }),
  // small phones: the copyright moves under the colour dots, so the dots (and the cat) sit a
  // little higher, and the name block is two lines again
  compact: withDefaults({ layout: { top: 84, bottom: 32, maxScale: 1 }, switcher: { bottom: COMPACT_ROW } }),
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
// ...and the sheet's corner labels (your name top-left, the sheet notes top-right)
const avoidDesk = (size) => [...avoidCatLeft(size), { x: 0, y: 0, w: 280, h: 100 }, { x: size.w - 260, y: 0, w: 260, h: 100 }]

// what the cat walks around: the phone (its whole unfolded area, as the iPod keeps clear of)
// and wherever the iPod is lying right now
const catObstacles = (settings) => () => {
  const w = document.documentElement.clientWidth
  const h = window.innerHeight
  const d = deviceFrame({ w, h }, settings.layout, settings.switcher)
  const out = [{ x: d.left, y: d.top, w: d.width, h: d.height }]
  // everything lying on the desk (the iPod, the booster pack), + its side and shadow
  for (const o of document.querySelectorAll('[data-desk-object]')) {
    if (!o.offsetWidth || getComputedStyle(o).visibility === 'hidden') continue
    const r = o.getBoundingClientRect()
    out.push({ x: r.left - 4, y: r.top - 4, w: r.width + 22, h: r.height + 24 })
  }
  return out
}
const OBSTACLES = { phone: catObstacles(SETTINGS.phone), compact: catObstacles(SETTINGS.compact), wide: catObstacles(SETTINGS.wide) }

// the cat's home sits on the switch's row, just inside of it (switch: 16px from the corner, ~175 wide)
const CAT_HOME_X = 16 + 176 + 10

export default function FoldPhoneHero() {
  const phone = useMedia('(max-width: 809.98px)')
  const compact = useMedia('(max-width: 559.98px)') // the device moves its finish switcher to the left here
  const settings = compact ? SETTINGS.compact : phone ? SETTINGS.phone : SETTINGS.wide
  const catSide = compact ? 'right' : 'left'
  // phones and tablets: no cursor to chase or run from, so no switch; the cat sits in its corner
  // and goes through its moods by itself (tap it and it reacts)
  const noCursor = useMedia('(hover: none), (pointer: coarse)')

  // Standalone: the phone fills the page (Fold 8 on wide screens, Flip 8 on phones) and opens with
  // the template's curtain intro.
  return (
    <>
      <SiteLoader />
      <FoldPhone
        {...settings}
        intro={{ color: MAT, line: 'rgba(255,255,255,.6)', off: true }} // SiteLoader reveals the page instead of the curtain
        screen={<Portfolio variant="fold" />}
        screenPortrait={<Portfolio variant="flip" />}
        cover={<LockScreen size="fold" />}
        coverPortrait={<LockScreen size="flip" />}
        call={<Call />}
        nav={<PortfolioNav />}
        backdrop={
          <>
            <DeskmatGrid />
            <SheetLabels />
            {!phone && <DeskIPod settings={settings} avoid={avoidDesk} ipod={IPOD} /> /* no iPod on mobile */}
          </>
        }
      />
      <NekoCat
        cat="lucky"
        scale={compact ? 1 : 1.5} // smaller on small screens, where it shares the row with the colour dots
        toggleCorner={`bottom-${catSide}`}
        obstacles={compact ? OBSTACLES.compact : phone ? OBSTACLES.phone : OBSTACLES.wide}
        cursorless={noCursor}
        // without the switch, home is the corner the switch had
        // (small phones: level with the colour dots' raised row)
        style={{ position: 'fixed', bottom: compact ? COMPACT_ROW + 1 : 11, [catSide]: noCursor ? 24 : CAT_HOME_X, zIndex: 30 }}
      />
    </>
  )
}
