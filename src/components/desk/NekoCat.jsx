import { useCallback, useEffect, useMemo, useRef, useState, startTransition } from 'react'

/* A little pixel cat (oneko / webneko sprites) and its "You like cats?" switch.
 * Ported from the Framer project's NekoCat.tsx code component, with the settings the Framer page
 * uses. Off: the cat naps at home and runs away from the cursor, then stays where it ended up for a
 * few minutes before walking home. On: it chases the cursor. The choice is remembered.
 *
 * The component's own box is the cat's home (the cat itself is drawn position: fixed).
 * The switch sits in a corner of the window (toggleCorner). `obstacles` are areas the cat walks
 * around but never over: it slides along their edges, waits at an edge when the cursor is on the
 * far side, and runs out if one ends up on top of it. */

const FRAME = 32
const WEBNEKO = 'https://webneko.net'
const FRAMES = {
  idle: ['still'],
  alert: ['alert'],
  tired: ['yawn'],
  sleeping: ['sleep1', 'sleep2'],
  scratchSelf: ['itch1', 'itch2', 'lickpaw'],
  scratchWallN: ['nscratch1', 'nscratch2'],
  scratchWallS: ['sscratch1', 'sscratch2'],
  scratchWallE: ['escratch1', 'escratch2'],
  scratchWallW: ['wscratch1', 'wscratch2'],
  N: ['nrun1', 'nrun2'],
  NE: ['nerun1', 'nerun2'],
  E: ['erun1', 'erun2'],
  SE: ['serun1', 'serun2'],
  S: ['srun1', 'srun2'],
  SW: ['swrun1', 'swrun2'],
  W: ['wrun1', 'wrun2'],
  NW: ['nwrun1', 'nwrun2'],
}
const WALLS = ['scratchWallN', 'scratchWallS', 'scratchWallE', 'scratchWallW']
const STORAGE_KEY = 'neko-cat-follow-choice'
const RETURN_HOME_TICKS = 5 * 60 * 10 // 5 minutes of 100 ms ticks

function direction(dx, dy) {
  const a = (Math.atan2(dy, dx) * 180) / Math.PI
  if (a >= -22.5 && a < 22.5) return 'E'
  if (a >= 22.5 && a < 67.5) return 'SE'
  if (a >= 67.5 && a < 112.5) return 'S'
  if (a >= 112.5 && a < 157.5) return 'SW'
  if (a >= 157.5 || a < -157.5) return 'W'
  if (a >= -157.5 && a < -112.5) return 'NW'
  if (a >= -112.5 && a < -67.5) return 'N'
  return 'NE'
}

const readChoice = () => {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === null ? null : v === 'true'
  } catch (e) {
    return null
  }
}
const saveChoice = (v) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(v))
  } catch (e) {}
}

export default function NekoCat({
  cat = 'lucky', // a webneko.net skin folder: white, black, calico, lucky, moka, ...
  scale = 1.5,
  followCursor = false,
  rememberChoice = true,
  speed = 10,
  fleeDistance = 120,
  fleeSpeed = 1.35,
  idleBehavior = 'sleep', // sleep | sit
  zIndex = 30,
  label = 'You like cats?',
  toggleCorner = 'bottom-left',
  obstacles, // () => [{ x, y, w, h }] in window coordinates the cat walks around, never over
  style,
}) {
  const px = FRAME * scale
  const obstaclesRef = useRef(obstacles)
  obstaclesRef.current = obstacles
  const rootRef = useRef(null)
  const mouse = useRef({ x: -1e4, y: -1e4 })
  const home = useRef({ x: 0, y: 0 })
  const pos = useRef(null)
  const state = useRef('idle')
  const frame = useRef(0)
  const idleTime = useRef(0)
  const tick = useRef(0)
  const override = useRef(0)
  const flee = useRef(0)
  const disturbed = useRef(false)
  const calm = useRef(0)

  const [, setRender] = useState(0)
  const [following, setFollowing] = useState(followCursor)

  // remembered choice
  useEffect(() => {
    if (!rememberChoice) return
    const saved = readChoice()
    if (saved !== null) startTransition(() => setFollowing(saved))
  }, [rememberChoice])
  const toggle = useCallback(() => {
    const v = !following
    setFollowing(v)
    if (rememberChoice) saveChoice(v)
  }, [following, rememberChoice])

  useEffect(() => {
    if (following) {
      disturbed.current = false
      calm.current = 0
    }
  }, [following])

  // preload every frame so the animation never flickers
  useEffect(() => {
    new Set(Object.values(FRAMES).flat()).forEach((n) => {
      const img = new window.Image()
      img.src = `${WEBNEKO}/${cat}/${n}.gif`
    })
  }, [cat])

  const measureHome = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    home.current = { x: r.left + r.width / 2 - px / 2, y: r.top + r.height / 2 - px / 2 }
    if (!pos.current) pos.current = { ...home.current }
  }, [px])

  useEffect(() => {
    measureHome()
    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', measureHome)
    window.addEventListener('scroll', measureHome, { passive: true })

    const loop = window.setInterval(() => {
      tick.current += 1
      const p = pos.current
      const m = mouse.current
      const maxX = Math.max(0, window.innerWidth - px)
      const maxY = Math.max(0, window.innerHeight - px)
      const clampX = (x) => Math.min(maxX, Math.max(0, x))
      const clampY = (y) => Math.min(maxY, Math.max(0, y))

      // things the cat may not walk over (the phone, the iPod), in window coordinates
      const obs = obstaclesRef.current ? obstaclesRef.current() : []
      const hit = (x, y, o) => x < o.x + o.w && x + px > o.x && y < o.y + o.h && y + px > o.y
      const blocked = (x, y) => obs.some((o) => hit(x, y, o))
      // one step towards (nx, ny): slides along an edge when only one axis is blocked
      const tryMove = (nx, ny) => {
        nx = clampX(nx)
        ny = clampY(ny)
        if (!blocked(nx, ny)) return [nx, ny]
        if (!blocked(nx, p.y)) return [nx, p.y]
        if (!blocked(p.x, ny)) return [p.x, ny]
        return [p.x, p.y]
      }

      // something landed on the cat (the phone unfolded, the iPod was dropped): run out the nearest way
      if (blocked(p.x, p.y)) {
        let best = null
        for (const o of obs) {
          if (!hit(p.x, p.y, o)) continue
          for (const [x, y] of [
            [o.x - px - 2, p.y],
            [o.x + o.w + 2, p.y],
            [p.x, o.y - px - 2],
            [p.x, o.y + o.h + 2],
          ]) {
            const c = [clampX(x), clampY(y)]
            if (blocked(c[0], c[1])) continue
            const d = Math.hypot(c[0] - p.x, c[1] - p.y)
            if (!best || d < best.d) best = { x: c[0], y: c[1], d }
          }
        }
        if (best) {
          const v = Math.min(speed * 2, best.d)
          const dx = best.x - p.x
          const dy = best.y - p.y
          p.x += (dx / (best.d || 1)) * v
          p.y += (dy / (best.d || 1)) * v
          state.current = direction(dx, dy)
          frame.current = tick.current % 2
          idleTime.current = 0
          override.current = 0
          startTransition(() => setRender((n) => n + 1))
          return
        }
      }

      const toX = m.x - (p.x + px / 2)
      const toY = m.y - (p.y + px / 2)
      const dist = Math.hypot(toX, toY)

      if (!following && dist <= fleeDistance) {
        flee.current = 4
        disturbed.current = true
        calm.current = 0
      } else if (flee.current > 0) {
        flee.current -= 1
      } else if (!following && disturbed.current && ++calm.current >= RETURN_HOME_TICKS) {
        disturbed.current = false
        calm.current = 0
      }

      const travel = ([nx, ny]) => Math.hypot(nx - p.x, ny - p.y)
      let walked = false

      if (!following && flee.current > 0) {
        // run straight away from the cursor; along the wall (or the phone / iPod) when cornered
        const v = Math.max(1, speed * fleeSpeed)
        const len = Math.max(1, dist)
        let step = tryMove(p.x - (toX / len) * v, p.y - (toY / len) * v)
        if (travel(step) < v * 0.25) {
          const ex = -toX / len
          const ey = -toY / len
          const a = tryMove(p.x - ey * v, p.y + ex * v)
          const b = tryMove(p.x + ey * v, p.y - ex * v)
          step = travel(a) >= travel(b) ? a : b
        }
        if (travel(step) > 0.5) {
          state.current = direction(step[0] - p.x, step[1] - p.y)
          ;[p.x, p.y] = step
          walked = true
        }
      } else {
        const target = following
          ? { x: m.x - px / 2, y: m.y - px / 2 }
          : disturbed.current
            ? { x: p.x, y: p.y } // stays put for a while after being chased off
            : home.current
        const dx = target.x - p.x
        const dy = target.y - p.y
        const d = Math.hypot(dx, dy)
        if (d > (following ? 48 : 4)) {
          const v = Math.min(speed, d)
          const step = tryMove(p.x + (dx / d) * v, p.y + (dy / d) * v)
          // fully blocked (the cursor is on the far side of the phone): wait at the edge
          if (travel(step) > 0.5) {
            state.current = direction(step[0] - p.x, step[1] - p.y)
            ;[p.x, p.y] = step
            walked = true
          }
        }
      }

      if (walked) {
        frame.current = tick.current % 2
        idleTime.current = 0
        override.current = 0
      } else {
        idleTime.current += 1
        if (override.current > 0) {
          override.current -= 1
          frame.current = (frame.current + 1) % FRAMES[state.current].length
        } else if (idleTime.current < 10) {
          state.current = 'idle'
          frame.current = 0
        } else if (idleTime.current < 20) {
          state.current = 'alert'
          frame.current = 0
        } else if (idleTime.current < 30) {
          state.current = 'tired'
          frame.current = 0
        } else {
          const r = Math.random()
          if (!following && idleBehavior === 'sit') {
            state.current = 'idle'
            override.current = 2
          } else if (r < 0.06) {
            state.current = 'scratchSelf'
            override.current = 9
          } else if (r < 0.08) {
            state.current = WALLS[Math.floor(Math.random() * WALLS.length)]
            override.current = 6
          } else {
            state.current = idleBehavior === 'sit' ? 'idle' : 'sleeping'
            override.current = 12
          }
          frame.current = 0
          idleTime.current = 20
        }
      }
      startTransition(() => setRender((n) => n + 1))
    }, 100)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', measureHome)
      window.removeEventListener('scroll', measureHome)
      window.clearInterval(loop)
    }
  }, [following, speed, fleeDistance, fleeSpeed, idleBehavior, px, measureHome])

  const poke = () => {
    state.current = Math.random() > 0.5 ? 'scratchSelf' : 'alert'
    frame.current = 0
    override.current = 8
    idleTime.current = 0
    startTransition(() => setRender((n) => n + 1))
  }

  const frames = FRAMES[state.current] || FRAMES.idle
  const src = `${WEBNEKO}/${cat}/${frames[frame.current % frames.length]}.gif`
  const p = pos.current || { x: -1e4, y: -1e4 }

  const corner = useMemo(() => {
    const c = { position: 'fixed', zIndex }
    c[toggleCorner.includes('top') ? 'top' : 'bottom'] = 16
    c[toggleCorner.includes('left') ? 'left' : 'right'] = 16
    return c
  }, [toggleCorner, zIndex])

  return (
    <div ref={rootRef} className="neko-home" style={{ width: px, height: px, ...style }}>
      <img
        alt=""
        src={src}
        width={px}
        height={px}
        draggable={false}
        onClick={poke}
        className="neko"
        style={{ left: p.x, top: p.y, width: px, height: px, zIndex }}
      />
      <label className="neko-toggle" style={corner}>
        <span>{label}</span>
        <button type="button" role="switch" aria-checked={following} aria-label={label} onClick={toggle} className="neko-switch">
          <span aria-hidden />
        </button>
      </label>
    </div>
  )
}
