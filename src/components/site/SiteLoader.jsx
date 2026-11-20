import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MAT } from './DeskmatGrid'
import { SITE } from './site'
import { markSiteReady } from './ready'
import SheetLabels from './TitleBlock'

/* The site loader: a technical drawing of the phone on the green cutting mat.
 *
 * It covers the page from the first paint and shows real loading progress (fonts, the page's images,
 * the window load event). While it loads, a wireframe of the phone is drawn in line by line, turning
 * slowly and opening on its hinge; the ruler under it is the progress bar. When everything is in,
 * "Enter the desk" folds the drawing shut, face-on, and a circular reveal opens onto the real phone.
 * Drag to turn the model; a tap on it (or Enter) goes in too. Returning visitors in the same
 * session skip the button.
 *
 * The device follows the site: Fold (book fold, hinge on the left) on wide screens, Flip (hinge at
 * the bottom) on phones. The sheet's grid lines up with the mat underneath (DeskmatGrid), so the
 * reveal only adds the phone and the things on the desk. */

const INK = '255,255,255' // the mat's printed lines
const ACCENT = '#ff5a36' // the site accent (--accent)
const FONT = "'Inter Variable', Inter, system-ui, sans-serif"
const MIN_MS = 1700 // first visit: let the drawing play even on a fast connection
const QUICK_MS = 500
const FAILSAFE_MS = 15000 // never trap anyone behind the loader

// model units: px of the site's own device (FoldPhone: Fold halves 500 x 940, Flip halves 358 x 411)
const DEVICES = {
  fold: { L: 500, Hh: 940, t: 30, r: 64, bezel: 16, roll: 0, name: 'Fold phone' },
  flip: { L: 411, Hh: 358, t: 26, r: 60, bezel: 14, roll: Math.PI / 2, name: 'Flip phone' },
}
const OPEN = (112 * Math.PI) / 180 // how far the drawing opens while loading

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const ink = (a) => `rgba(${INK},${a})`
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

// a rounded rectangle in a panel's (u, v) plane, as a closed list of points
function rrect(u0, v0, u1, v1, r, n = 7) {
  const pts = []
  const c = [
    [u1 - r, v0 + r, -Math.PI / 2],
    [u1 - r, v1 - r, 0],
    [u0 + r, v1 - r, Math.PI / 2],
    [u0 + r, v0 + r, Math.PI],
  ]
  for (const [cu, cv, a0] of c)
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r])
    }
  pts.push(pts[0])
  return pts
}
function circle(cu, cv, r, n = 20) {
  const pts = []
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cu + Math.cos(a) * r, cv + Math.sin(a) * r])
  }
  return pts
}

export default function SiteLoader() {
  const rootRef = useRef(null)
  const cvRef = useRef(null)
  const pctRef = useRef(null)
  const ctaRef = useRef(null)
  const btnRef = useRef(null)
  const [phase, setPhase] = useState('loading') // loading | ready | leaving | gone
  const [quick, setQuick] = useState(false)
  const S = useRef({
    target: 0.03, real: 0, shown: 0, t0: 0, quick: false, phase: 'loading', leaveT: 0,
    spin: -0.5, spinV: 0.2, tilt: 0, tiltT: 0, drag: null, moved: 0, fold: 0,
    box: null, // smoothed on-screen box of the drawing
  }).current
  S.phase = phase

  // first paint: lock the page under the loader, decide quick mode
  useIso(() => {
    S.t0 = performance.now()
    try {
      S.quick = sessionStorage.getItem('loader-seen') === '1'
      sessionStorage.setItem('loader-seen', '1')
    } catch (e) {}
    setQuick(S.quick)
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    window.scrollTo(0, 0)
    const html = document.documentElement
    const prev = html.style.overflow
    html.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prev
    }
  }, [])

  // real progress: fonts, the window load event and every image on the page (decoded)
  useEffect(() => {
    let done = 0
    let total = 0
    let dead = false
    const track = (p) => {
      total++
      Promise.resolve(p)
        .catch(() => {})
        .then(() => {
          if (dead) return
          done++
          S.real = done / total
        })
    }
    track(document.fonts ? document.fonts.ready : null)
    track(document.readyState === 'complete' ? null : new Promise((r) => window.addEventListener('load', r, { once: true })))
    // the page has rendered under the loader by the next frame: wait for its images too
    const raf = requestAnimationFrame(() => {
      for (const img of Array.from(document.images)) {
        if (img.closest('[data-site-loader]')) continue
        track(img.decode ? img.decode() : img.complete ? null : new Promise((r) => (img.onload = img.onerror = r)))
      }
    })
    const fail = setTimeout(() => (S.real = 1), FAILSAFE_MS)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
      clearTimeout(fail)
    }
  }, [])

  const enter = () => {
    if (S.phase !== 'ready') return
    S.leaveT = 0
    S.phase = 'leaving'
    setPhase('leaving')
  }
  useEffect(() => {
    if (phase === 'ready') {
      if (S.quick) {
        const t = setTimeout(enter, 150)
        return () => clearTimeout(t)
      }
      btnRef.current?.focus({ preventScroll: true })
    }
    if (phase === 'gone') document.documentElement.style.overflow = ''
  }, [phase])
  useEffect(() => {
    const k = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && S.phase === 'ready' && document.activeElement?.tagName !== 'BUTTON') {
        e.preventDefault()
        enter()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  // the drawing
  useEffect(() => {
    const cv = cvRef.current
    const root = rootRef.current
    if (!cv || !root) return
    const ctx = cv.getContext('2d')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, dpr = 1, raf = 0, last = performance.now(), dead = false
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      W = root.clientWidth
      H = root.clientHeight
      cv.width = Math.round(W * dpr)
      cv.height = Math.round(H * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(root)

    // hover tilts the model, drag turns it (with a little inertia)
    const down = (e) => {
      if (S.phase === 'leaving' || e.target.closest?.('button')) return
      S.drag = { x: e.clientX, y: e.clientY, s: S.spin, t: performance.now() }
      S.moved = 0
    }
    const move = (e) => {
      const r = root.getBoundingClientRect()
      S.tiltT = clamp(((e.clientY - r.top) / r.height - 0.5) * 0.6, -0.3, 0.3)
      if (S.drag) {
        const dx = e.clientX - S.drag.x
        S.moved = Math.max(S.moved, Math.abs(dx) + Math.abs(e.clientY - S.drag.y))
        const ns = S.drag.s + dx * 0.008
        const now = performance.now()
        S.spinV = clamp(((ns - S.spin) / Math.max(1, now - S.drag.t)) * 1000, -6, 6)
        S.spin = ns
        S.drag.t = now
      }
    }
    const up = (e) => {
      const was = S.drag
      S.drag = null
      // a tap on the drawing goes in too
      if (was && S.moved < 6 && S.phase === 'ready' && S.box) {
        const r = root.getBoundingClientRect()
        const x = e.clientX - r.left, y = e.clientY - r.top, b = S.box
        if (x > b.x0 - 20 && x < b.x1 + 20 && y > b.y0 - 20 && y < b.y1 + 20) enter()
      }
    }
    root.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)

    const P = [0, 0, 0]
    function frame(now) {
      if (dead) return
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const D = W < 810 ? DEVICES.flip : DEVICES.fold
      const { L, Hh, t, r, bezel, roll } = D

      // ---- progress: ease towards the real figure, never faster than the minimum show time
      const elapsed = now - S.t0
      const minT = clamp(elapsed / (S.quick ? QUICK_MS : MIN_MS), 0, 1)
      const cap = S.real >= 1 ? minT : Math.min(0.96, S.real + 0.1, minT)
      S.target = Math.max(S.target, Math.min(cap, S.target + dt * 0.02)) // creep, so it never looks stuck
      S.target = Math.max(S.target, Math.min(S.real, minT))
      S.shown += (S.target - S.shown) * (1 - Math.exp(-dt * (S.quick ? 9 : 3.4)))
      if (S.real >= 1 && minT >= 1 && S.shown > 0.995) S.shown = 1
      if (pctRef.current) pctRef.current.textContent = String(Math.round(S.shown * 100))
      if (S.shown === 1 && S.phase === 'loading') {
        S.phase = 'ready'
        setPhase('ready')
      }
      const p = S.shown

      // ---- motion: idle turn, pointer tilt, hinge opening with progress
      let foldT = ease(clamp((p - 0.12) / 0.6, 0, 1)) * OPEN
      if (S.phase === 'ready') foldT = OPEN + (reduced ? 0 : Math.sin(now / 900) * 0.06)
      let leave = 0
      if (S.phase === 'leaving') {
        S.leaveT = Math.min(1, S.leaveT + dt / (reduced ? 0.5 : 1.7))
        leave = S.leaveT
        foldT = 0 // fold shut...
        // ...and turn to face the viewer, the way the real phone lies on the mat
        const home = Math.round(S.spin / (Math.PI * 2)) * Math.PI * 2
        S.spin += (home - S.spin) * (1 - Math.exp(-dt * 7))
        S.spinV = 0
        S.tiltT = 0
      } else if (!S.drag) {
        S.spinV += ((reduced ? 0 : 0.24) - S.spinV) * (1 - Math.exp(-dt * 1.2))
        S.spin += S.spinV * dt
      }
      S.fold += (foldT - S.fold) * (1 - Math.exp(-dt * (S.phase === 'leaving' ? 8 : 4)))
      S.tilt += (S.tiltT - S.tilt) * (1 - Math.exp(-dt * 3))
      const phi = S.fold

      // ---- view: size, centre, rotations, a touch of perspective
      const size = clamp(Math.min(W, H) * (W < 700 ? 0.66 : 0.46), 200, 440)
      const k = size / Math.max(Hh, 1.6 * L)
      const cx = W / 2
      const cy = H / 2 - (W < 700 ? 10 : 0)
      const pitch = (S.phase === 'leaving' ? 0 : -0.32) * (1 - ease(leave)) + S.tilt
      const yaw = S.spin
      const cr = Math.cos(roll), sr = Math.sin(roll)
      const cyw = Math.cos(yaw), syw = Math.sin(yaw)
      const cp = Math.cos(pitch), sp = Math.sin(pitch)
      const xc = (L * (1 + Math.cos(phi))) / 4 // centre of the model at this opening
      const proj = (x, y, z, out) => {
        x -= xc
        // roll in the device plane (the Flip's hinge sits at the bottom), then turn and tilt
        const x1 = x * cr - y * sr, y1 = x * sr + y * cr
        const x2 = x1 * cyw + z * syw, z2 = -x1 * syw + z * cyw
        const y3 = y1 * cp - z2 * sp, z3 = y1 * sp + z2 * cp
        const f = 2400 / (2400 - z3)
        out[0] = cx + x2 * k * f
        out[1] = cy - y3 * k * f
        out[2] = z3
        return out
      }
      // facing the viewer? (normal through the same rotations, z only)
      const facing = (nx, ny, nz) => {
        const x1 = nx * cr - ny * sr, y1 = nx * sr + ny * cr
        const z2 = -x1 * syw + nz * cyw
        return y1 * sp + z2 * cp
      }
      const cph = Math.cos(phi), sph = Math.sin(phi)
      // panel A lies flat (inner face z = 0, back at -t); panel B turns about the hinge line x = 0
      const A = (u, v, w) => [u, v, -w]
      const B = (u, v, w) => [u * cph - w * sph, v, u * sph + w * cph]

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      const fade = 1 - clamp(leave * 2.4 - 1.2, 0, 1) // the drawing goes once the reveal is under way

      // strokes, in the order they're drawn in; each reveals over its own slice of the progress
      const v0 = -Hh / 2, v1 = Hh / 2
      const outline = rrect(0, v0, L, v1, r)
      const inner = rrect(bezel, v0 + bezel, L - bezel, v1 - bezel, r - bezel * 0.7)
      const cover = rrect(bezel + 6, v0 + bezel + 6, L - bezel - 6, v1 - bezel - 6, r - bezel)
      const corners = [[r * 0.3, v0 + r * 0.3], [L - r * 0.3, v0 + r * 0.3], [L - r * 0.3, v1 - r * 0.3], [r * 0.3, v1 - r * 0.3]]
      const camera = D === DEVICES.fold ? [[L / 2, v1 - 42, 9]] : [[L - 70, v0 + 64, 26], [L - 70, v0 + 132, 26]]
      const nA = [0, 0, 1], nAb = [0, 0, -1], nBi = [sph, 0, -cph], nBo = [-sph, 0, cph]
      const strokes = [
        { pts: outline, map: A, w: 0, n: nA, at: 0.04 },
        { pts: outline, map: A, w: t, n: nAb, at: 0.1 },
        { pts: outline, map: B, w: 0, n: nBi, at: 0.16 },
        { pts: outline, map: B, w: t, n: nBo, at: 0.22 },
        { edges: corners, map: A, at: 0.28 },
        { edges: corners, map: B, at: 0.32 },
        { pts: inner, map: A, w: 0, n: nA, at: 0.38, a: 0.7 },
        { pts: inner, map: B, w: 0, n: nBi, at: 0.44, a: 0.7 },
        { pts: cover, map: B, w: t, n: nBo, at: 0.5, a: 0.7 },
        { hinge: true, at: 0.56 },
        ...camera.map(([u, v, cr2]) => ({ pts: circle(u, v, cr2), map: B, w: t, n: nBo, at: 0.62, a: 0.8 })),
      ]
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
      const grow = (q) => {
        if (q[0] < x0) x0 = q[0]
        if (q[0] > x1) x1 = q[0]
        if (q[1] < y0) y0 = q[1]
        if (q[1] > y1) y1 = q[1]
      }
      ctx.strokeStyle = ink(1)
      for (const s of strokes) {
        const rev = S.phase === 'leaving' ? 1 : clamp((p - s.at) / 0.2, 0, 1)
        if (rev <= 0) continue
        if (s.edges) {
          // the panel's thickness at its four corners
          ctx.lineWidth = 1
          ctx.globalAlpha = 0.5 * rev * fade
          ctx.beginPath()
          for (const [u, v] of s.edges) {
            const a = proj(...s.map(u, v, 0), P), ax = a[0], ay = a[1]
            const b = proj(...s.map(u, v, t), P)
            ctx.moveTo(ax, ay)
            ctx.lineTo(b[0], b[1])
          }
          ctx.stroke()
          continue
        }
        if (s.hinge) {
          ctx.lineWidth = 1.6
          ctx.globalAlpha = rev * fade
          const a = proj(0, v0 + r * 0.6, 0, P), ax = a[0], ay = a[1]
          const b = proj(0, v0 + r * 0.6 + (Hh - r * 1.2) * rev, 0, P)
          ctx.beginPath()
          ctx.moveTo(ax, ay)
          ctx.lineTo(b[0], b[1])
          ctx.stroke()
          continue
        }
        const front = facing(...s.n) > 0
        const n = Math.max(2, Math.floor(s.pts.length * rev))
        ctx.lineWidth = front ? 1.25 : 1
        ctx.globalAlpha = (front ? s.a || 1 : 0.16) * fade
        ctx.setLineDash(front ? [] : [3, 4])
        ctx.beginPath()
        for (let i = 0; i < n; i++) {
          const q = proj(...s.map(s.pts[i][0], s.pts[i][1], s.w), P)
          if (s.w !== undefined && s.pts === outline) grow(q)
          if (i) ctx.lineTo(q[0], q[1])
          else ctx.moveTo(q[0], q[1])
        }
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.globalAlpha = 1
      if (x0 === Infinity) {
        x0 = cx - size * 0.25; x1 = cx + size * 0.25; y0 = cy - size / 2; y1 = cy + size / 2
      }
      // smooth the box the dimension lines and the button follow
      const bx = S.box || { x0, x1, y0, y1 }
      const sm = 1 - Math.exp(-dt * 6)
      S.box = { x0: bx.x0 + (x0 - bx.x0) * sm, x1: bx.x1 + (x1 - bx.x1) * sm, y0: bx.y0 + (y0 - bx.y0) * sm, y1: bx.y1 + (y1 - bx.y1) * sm }
      const box = S.box

      // centre lines (dash-dot), like a drawing's axes
      ctx.strokeStyle = ink(1)
      ctx.lineWidth = 1
      ctx.setLineDash([14, 4, 2, 4])
      ctx.globalAlpha = 0.22 * fade
      ctx.beginPath()
      ctx.moveTo(cx - size * 0.62, cy)
      ctx.lineTo(cx + size * 0.62, cy)
      ctx.moveTo(cx, cy - size * 0.6)
      ctx.lineTo(cx, cy + size * 0.6)
      ctx.stroke()
      ctx.setLineDash([])

      // numbered callouts on the parts, while that part faces the viewer
      ctx.font = `500 10px ${FONT}`
      ctx.textBaseline = 'middle'
      const callouts = [
        { pos: B(L * 0.5, Hh * 0.12, t), n: nBo, label: 'Cover screen', at: 0.58 },
        { pos: A(0, Hh * 0.28, 0), n: null, label: 'Hinge', at: 0.64 },
        { pos: A(L * 0.55, -Hh * 0.18, 0), n: nA, label: 'Main screen', at: 0.7 },
        { pos: B(camera[0][0], camera[0][1], t), n: nBo, label: 'Camera', at: 0.76 },
      ]
      const placed = [] // label boxes so far: nudge a label down if it would sit on another
      callouts.forEach((c, i) => {
        const show = clamp((p - c.at) / 0.14, 0, 1) * (1 - clamp(leave * 4, 0, 1))
        if (show <= 0) return
        const f = c.n ? clamp(facing(...c.n) * 3, 0, 1) : 1
        if (f <= 0) return
        const q = proj(...c.pos, P)
        const al = show * f * fade
        const side = q[0] >= cx ? 1 : -1
        ctx.globalAlpha = al
        ctx.fillStyle = ACCENT
        ctx.beginPath()
        ctx.arc(q[0], q[1], 3.2, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = ACCENT
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(q[0], q[1], 7, 0, Math.PI * 2)
        ctx.stroke()
        // leader out to the label
        const txt = `0${i + 1}  ${c.label}`
        const tw = ctx.measureText(txt).width
        const lx = q[0] + side * 26
        let ly = q[1] - 14
        const lx0 = side > 0 ? lx : lx - 24 - tw, lx1 = side > 0 ? lx + 24 + tw : lx
        for (let n = 0; n < 6 && placed.some((b) => Math.abs(b.y - ly) < 15 && b.x0 < lx1 && b.x1 > lx0); n++) ly += 16
        placed.push({ x0: lx0, x1: lx1, y: ly })
        ctx.strokeStyle = ink(0.7)
        ctx.beginPath()
        ctx.moveTo(q[0] + side * 7, q[1] - 4)
        ctx.lineTo(lx, ly)
        ctx.lineTo(lx + side * 10, ly)
        ctx.stroke()
        ctx.fillStyle = ink(1)
        ctx.textAlign = side > 0 ? 'left' : 'right'
        ctx.fillText(txt, lx + side * 14, ly)
      })
      ctx.globalAlpha = 1

      // the ruler under the drawing: this is the progress bar
      const ra = clamp(p / 0.08, 0, 1) * fade * (1 - clamp(leave * 3, 0, 1))
      if (ra > 0) {
        const half = Math.min(size * 0.42, W / 2 - 40)
        const y = box.y1 + 34
        const a = cx - half, b = cx + half, pen = a + (b - a) * p
        ctx.strokeStyle = ink(1)
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.25 * ra
        ctx.beginPath()
        ctx.moveTo(a, y)
        ctx.lineTo(b, y)
        ctx.stroke()
        // a tick every tenth, longer at the ends and the middle
        ctx.beginPath()
        for (let i = 0; i <= 10; i++) {
          const x = a + ((b - a) * i) / 10, len = i % 5 === 0 ? 9 : 4
          ctx.moveTo(x, y - len)
          ctx.lineTo(x, y + (i % 5 === 0 ? len : 0))
        }
        ctx.stroke()
        ctx.globalAlpha = ra
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(a, y)
        ctx.lineTo(pen, y)
        ctx.stroke()
        if (p < 1) {
          ctx.fillStyle = ACCENT
          ctx.beginPath()
          ctx.arc(pen, y, 3.4, 0, Math.PI * 2)
          ctx.fill()
        }
        // the drawing's name, set into the ruler once it's drawn
        const la = clamp((p - 0.3) / 0.3, 0, 1) * ra
        if (la > 0) {
          ctx.font = `500 11px ${FONT}`
          ctx.textAlign = 'center'
          const tw = ctx.measureText(D.name).width + 14
          ctx.globalAlpha = la
          ctx.fillStyle = MAT
          ctx.fillRect(cx - tw / 2, y + 10, tw, 16)
          ctx.fillStyle = ink(0.9)
          ctx.fillText(D.name, cx, y + 18.5)
        }
        ctx.globalAlpha = 1
      }
      // height dimension to the right of the drawing
      const ha = clamp((p - 0.4) / 0.3, 0, 1) * fade * (1 - clamp(leave * 3, 0, 1))
      if (ha > 0) {
        const x = Math.min(box.x1 + 30, W - 24)
        const h0 = box.y0, h1 = box.y0 + (box.y1 - box.y0) * ha
        ctx.strokeStyle = ink(1)
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.55 * ha
        ctx.beginPath()
        ctx.moveTo(x, h0)
        ctx.lineTo(x, h1)
        ctx.moveTo(x - 9, box.y0)
        ctx.lineTo(x + 9, box.y0)
        ctx.moveTo(x - 9, box.y1)
        ctx.lineTo(x + 9, box.y1)
        ctx.moveTo(x - 4, box.y0 + 4)
        ctx.lineTo(x + 4, box.y0 - 4)
        ctx.moveTo(x - 4, box.y1 + 4)
        ctx.lineTo(x + 4, box.y1 - 4)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      if (ctaRef.current && S.phase !== 'leaving') ctaRef.current.style.top = `${Math.round(box.y1 + 74)}px`

      // ---- the reveal: a circle opens from the folded drawing out past the corners
      if (S.phase === 'leaving') {
        const k2 = clamp((leave - 0.32) / 0.68, 0, 1)
        if (k2 > 0 && !S.marked) {
          S.marked = true
          markSiteReady()
        }
        const e = ease(k2)
        const start = Math.hypot(box.x1 - box.x0, box.y1 - box.y0) / 2
        const end = Math.hypot(W, H) / 2 + 40
        const hole = reduced ? 0 : start + (end - start) * e
        const mx = ((box.x0 + box.x1) / 2).toFixed(1), my = ((box.y0 + box.y1) / 2).toFixed(1)
        const m = k2 > 0 && !reduced ? `radial-gradient(circle at ${mx}px ${my}px, transparent ${hole.toFixed(1)}px, #000 ${(hole + 1.5).toFixed(1)}px)` : ''
        root.style.webkitMaskImage = m
        root.style.maskImage = m
        if (reduced) root.style.opacity = String(1 - k2)
        if (leave >= 1) {
          dead = true
          setPhase('gone')
          return
        }
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
      ro.disconnect()
      root.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  if (phase === 'gone') return null
  const ready = phase === 'ready'
  const leaving = phase === 'leaving'
  return (
    <div
      ref={rootRef}
      data-site-loader=""
      className={`site-loader${leaving ? ' is-leaving' : ''}${ready ? ' is-ready' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${SITE.name}, loading`}
      style={{ '--mat': MAT, '--accent-l': ACCENT }}
    >
      <canvas ref={cvRef} aria-hidden="true" className="sl-canvas" />
      <span className="sl-corner sl-tl" aria-hidden="true" />
      <span className="sl-corner sl-tr" aria-hidden="true" />
      <span className="sl-corner sl-bl" aria-hidden="true" />
      <span className="sl-corner sl-br" aria-hidden="true" />
      {/* the same corner labels sit on the mat underneath, so they stay through the reveal */}
      <SheetLabels />
      <div className="sl-ui sl-count" aria-live="polite">
        <div className="sl-muted">{ready || leaving ? 'Phone ready' : 'Assembling the phone'}</div>
        <div className="sl-pct">
          <span ref={pctRef}>0</span>
          <span className="sl-pct-sign">%</span>
        </div>
      </div>
      <div ref={ctaRef} className="sl-ui sl-cta">
        {ready && !quick ? (
          <button ref={btnRef} type="button" className="sl-enter" onClick={enter}>
            Enter the desk
            <span className="sl-enter-arrow" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14">
                <path d="M5 11L11 5M6 5h5v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ) : (
          !quick && <div className="sl-muted sl-hint">Drag to turn the phone</div>
        )}
      </div>
    </div>
  )
}
