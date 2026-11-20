import { useEffect, useRef, useState } from 'react'
import { deviceFrame } from '../foldphone/FoldPhoneDevice'
import IPodPlayer from './IPodPlayer'
import { isSiteReady, onSiteReady } from '../site/ready'

/* The iPod lying on the desk mat, in FoldPhone's backdrop slot (under the phone).
 * It lands somewhere random on every visit, never on the phone or the space the phone takes up
 * when it unfolds, nor on the finish switcher or the cat's corner. On tighter screens it shrinks a
 * little; when there is no room at all it stays off the mat. Drag it by its body to move it. */

const IPOD = { w: 200, h: 372 } // the device, see IPodPlayer
const SCALES = [1, 0.85, 0.72, 0.62] // tried in order until one fits
const GAP = 28 // clear space kept around the unfolded phone (it also tilts towards the cursor)
const EDGE = { x: 24, top: 60, bottom: 56 } // stay inside the mat's rulers
const TRIES = 400

// the other things lying on the desk (iPod, booster pack, ...: anything marked data-desk-object),
// as rects in the desk layer's coordinates with a little space around them
export function otherDeskObjects(layer, self, pad = 18) {
  if (!layer) return []
  const l = layer.getBoundingClientRect()
  return Array.from(document.querySelectorAll('[data-desk-object]'))
    .filter((e) => e !== self && e.offsetWidth)
    .map((e) => {
      const r = e.getBoundingClientRect()
      return { x: r.left - l.left - pad, y: r.top - l.top - pad, w: r.width + 2 * pad, h: r.height + 2 * pad }
    })
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

// the areas to keep clear on a stage of size { w, h }
export function keepClear({ w, h }, { layout, switcher }, extra = []) {
  const d = deviceFrame({ w, h }, layout, switcher)
  const compact = w < 560 // the device puts its switcher on the left on small screens
  return [
    { x: d.left - GAP, y: d.top - GAP, w: d.width + 2 * GAP, h: d.height + 2 * GAP },
    compact
      ? { x: 0, y: h - switcher.bottom - 48, w: switcher.right + 140, h: switcher.bottom + 48 }
      : { x: w / 2 - 120, y: h - switcher.bottom - 48, w: 240, h: switcher.bottom + 48 },
    ...extra,
  ]
}

export function fits(r, size, blocked) {
  return (
    r.x >= EDGE.x &&
    r.y >= EDGE.top &&
    r.x + r.w <= size.w - EDGE.x &&
    r.y + r.h <= size.h - EDGE.bottom &&
    !blocked.some((b) => overlaps(r, b))
  )
}

// a random free spot for an object of size dims, trying each scale in turn; null = no room
export function pickSpot(size, blocked, dims = IPOD, scales = SCALES) {
  for (const k of scales) {
    const w = dims.w * k
    const h = dims.h * k
    const spanX = size.w - 2 * EDGE.x - w
    const spanY = size.h - EDGE.top - EDGE.bottom - h
    if (spanX < 0 || spanY < 0) continue
    for (let i = 0; i < TRIES; i++) {
      const r = { x: EDGE.x + Math.random() * spanX, y: EDGE.top + Math.random() * spanY, w, h }
      if (fits(r, size, blocked)) return { x: Math.round(r.x), y: Math.round(r.y), k }
    }
  }
  return null
}

export default function DeskIPod({ settings, avoid, ipod }) {
  const box = useRef(null)
  const [size, setSize] = useState(null)
  const [spot, setSpot] = useState(null) // { x, y, k } top-left of the scaled iPod, or null = no room
  const moved = useRef(false) // dragged by hand: keep it where it was put
  const drag = useRef(null)
  const el = useRef(null)
  const shown = useRef(false)

  // settle in once the loader has revealed the page (like Framer's appear effect: scale .8 -> 1).
  // Played with the Web Animations API: the device restyles the stage every frame, which keeps
  // restarting CSS animations inside it. Hidden until then.
  const [revealed, setRevealed] = useState(isSiteReady)
  useEffect(() => onSiteReady(() => setRevealed(true)), [])
  useEffect(() => {
    if (!spot || !revealed || shown.current || !el.current) return
    shown.current = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !el.current.animate) return
    el.current.animate([{ opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }], {
      duration: 450,
      delay: 750,
      easing: 'cubic-bezier(.34, 1.3, .64, 1)',
      fill: 'backwards',
    })
  }, [spot, revealed])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width)
      const h = Math.round(e.contentRect.height)
      if (w && h) setSize((s) => (s && s.w === w && s.h === h ? s : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // place it (first time), and again if a resize puts the phone on top of it
  useEffect(() => {
    if (!size) return
    setSpot((cur) => {
      if (cur && moved.current) {
        const w = IPOD.w * cur.k
        const h = IPOD.h * cur.k
        return { ...cur, x: Math.min(Math.max(0, cur.x), size.w - w), y: Math.min(Math.max(0, cur.y), size.h - h) }
      }
      const blocked = keepClear(size, settings, [...(avoid ? avoid(size) : []), ...otherDeskObjects(box.current, el.current)])
      if (cur && fits({ x: cur.x, y: cur.y, w: IPOD.w * cur.k, h: IPOD.h * cur.k }, size, blocked)) return cur
      return pickSpot(size, blocked)
    })
  }, [size, settings, avoid])

  const onPointerDown = (e) => {
    if (!spot || e.button > 0 || e.target.closest('[data-ipod-nodrag]')) return
    drag.current = { id: e.pointerId, dx: e.clientX - spot.x, dy: e.clientY - spot.y }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.classList.add('is-dragging')
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId || !size) return
    moved.current = true
    const w = IPOD.w * spot.k
    const h = IPOD.h * spot.k
    const x = Math.min(Math.max(0, e.clientX - d.dx), size.w - w)
    const y = Math.min(Math.max(0, e.clientY - d.dy), size.h - h)
    setSpot((s) => ({ ...s, x, y }))
  }
  const onPointerUp = (e) => {
    if (!drag.current || drag.current.id !== e.pointerId) return
    drag.current = null
    e.currentTarget.classList.remove('is-dragging')
  }

  return (
    <div ref={box} className="desk-layer">
      {spot && (
        <div
          ref={el}
          className="desk-ipod"
          data-desk-object=""
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{ left: spot.x, top: spot.y, width: IPOD.w * spot.k, height: IPOD.h * spot.k, opacity: revealed ? undefined : 0 }}
        >
          <div style={{ width: IPOD.w, height: IPOD.h, transform: spot.k === 1 ? undefined : `scale(${spot.k})`, transformOrigin: '0 0' }}>
            <IPodPlayer {...ipod} />
          </div>
        </div>
      )}
    </div>
  )
}
