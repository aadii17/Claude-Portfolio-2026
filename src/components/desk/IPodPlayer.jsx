import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from 'react'

/* A first-generation-style iPod with a working click wheel, playing YouTube tracks.
 * Ported from the Framer project's code component (Workshop/IPodPlayer.tsx, by Zihan Huang,
 * bravohenry.com) with the same look and menus. Changes for living on the desk mat all the time:
 *  - the arrow keys / Enter / Esc only drive the iPod while it has focus (not the whole page)
 *  - the YouTube player API loads once the iPod is woken (hover, tap or focus), not on page load
 *  - the menu scrolls inside its own box (never scrolls the page)
 *
 * Props: theme 'classic' | 'black' | 'u2', youtubeUrl (comma-separated links or ids; empty = three
 * sample tracks), ownerName (boot screen), font (style object for the screen text), textShadow,
 * size 'default' | 'medium' | 'large'. The device itself is 200 x 372. */

const SAMPLE_TRACKS = [
  { id: 'dQw4w9WgXcQ', title: 'Never Gonna Give You Up', artist: 'Rick Astley' },
  { id: '9bZkp7q19f0', title: 'Gangnam Style', artist: 'PSY' },
  { id: 'kJQP7kiw5Fk', title: 'Despacito', artist: 'Luis Fonsi' },
].map((t) => ({ ...t, url: `https://www.youtube.com/watch?v=${t.id}` }))

function videoId(raw) {
  const u = raw.trim()
  const m = u.match(/youtube\.com\/watch\?v=([\w-]{11})/) || u.match(/youtu\.be\/([\w-]{11})/)
  if (m) return m[1]
  return /^[\w-]{11}$/.test(u) ? u : null
}

// load the YouTube IFrame API once per page
let ytPromise = null
function loadYouTube() {
  if (typeof window === 'undefined') return Promise.reject()
  if (window.YT && window.YT.Player) return Promise.resolve()
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev()
        resolve()
      }
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return ytPromise
}

// 3D: the angle it lies at (deg; flat, face-on), and the body's thickness
const REST = { x: 0, y: 0 }
const DEPTH = 22 // px of body behind the face
const SLICES = Array.from({ length: 16 }, (_, i) => {
  const z = ((i + 1) / 16) * DEPTH
  return { z, steel: z > 6 } // ~6px of white acrylic front, the rest polished steel
})
const ACRYLIC = 'linear-gradient(160deg, #ffffff, #e9e9e9 50%, #d6d6d6)'
const STEEL = 'linear-gradient(135deg, #fbfcfd 0%, #b9bec4 22%, #eef0f2 38%, #8f959b 55%, #dfe2e5 72%, #7b8187 100%)'

const fmt = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
const fill = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }

export default function IPodPlayer({
  theme = 'classic',
  youtubeUrl = '',
  textShadow = false,
  font = {},
  ownerName = '',
  size = 'default',
  style,
}) {
  const [tracks, setTracks] = useState(SAMPLE_TRACKS)
  const [trackIndex, setTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [menu, setMenu] = useState(['main', 'music', 'allsongs'])
  const [selected, setSelected] = useState(0)
  const [backlight, setBacklight] = useState(false)
  const [autoBacklight, setAutoBacklight] = useState(false) // stays off until the boot animation has run
  const [lcdFilter, setLcdFilter] = useState(true)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState('off') // off | one | all
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playerReady, setPlayerReady] = useState(false)
  const [apiReady, setApiReady] = useState(false)
  const [forcePlay, setForcePlay] = useState(0)
  const [battery, setBattery] = useState(1)
  const [woken, setWoken] = useState(false) // hovered, tapped or focused at least once
  const [booted, setBooted] = useState(false)

  const scrollRef = useRef(null)
  const wheelRef = useRef(null)
  const playerRef = useRef(null)
  const progressRef = useRef(null)
  const lastAngle = useRef(0)
  const backlightTimer = useRef(null)
  const autoPlay = useRef(false)
  const nextRef = useRef(() => {})
  const repeatRef = useRef(repeat)
  repeatRef.current = repeat

  const track = tracks[trackIndex]
  const ink = backlight ? '#0a3667' : '#2a2a2a'
  const line = backlight ? '#0a3667' : '#4a4a4a'
  const lcd = backlight ? '#c5e0f5' : '#9ca49c'
  const glyph = theme === 'classic' ? '#666' : theme === 'u2' ? '#fff' : '#ccc'
  const engrave = theme === 'classic' ? '0 1px 0 rgba(255,255,255,0.5)' : '0 1px 2px rgba(0,0,0,0.5)'

  // ---------- backlight: on with any input, off after 30 s
  const poke = useCallback(() => {
    if (!autoBacklight) return
    if (!backlight) startTransition(() => setBacklight(true))
    clearTimeout(backlightTimer.current)
    backlightTimer.current = window.setTimeout(() => startTransition(() => setBacklight(false)), 30000)
  }, [backlight, autoBacklight])
  useEffect(() => () => clearTimeout(backlightTimer.current), [])

  // ---------- boot: half a second after the first hover / tap / focus
  useEffect(() => {
    if (!woken || booted) return
    const t = window.setTimeout(() => {
      startTransition(() => {
        setBooted(true)
        setBacklight(true)
        setAutoBacklight(true)
      })
    }, 500)
    return () => clearTimeout(t)
  }, [woken, booted])
  useEffect(() => {
    if (booted) poke()
  }, [booted]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- tracks from the YouTube links (titles from oEmbed)
  useEffect(() => {
    const ids = youtubeUrl.split(',').map(videoId).filter(Boolean)
    if (!ids.length) {
      startTransition(() => setTracks(SAMPLE_TRACKS))
      return
    }
    const list = ids.map((id) => ({ id, url: `https://www.youtube.com/watch?v=${id}`, title: 'Loading...', artist: 'YouTube' }))
    startTransition(() => {
      setTracks(list)
      setTrackIndex(0)
    })
    let live = true
    list.forEach(async (t, i) => {
      try {
        const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(t.url)}&format=json`)
        if (!r.ok || !live) return
        const d = await r.json()
        startTransition(() =>
          setTracks((prev) => prev.map((p, j) => (j === i ? { ...p, title: d.title || p.title, artist: d.author_name || 'YouTube' } : p))),
        )
      } catch (e) {}
    })
    return () => {
      live = false
    }
  }, [youtubeUrl])

  // ---------- YouTube player
  useEffect(() => {
    if (!woken) return
    let live = true
    loadYouTube().then(() => live && startTransition(() => setApiReady(true)), () => {})
    return () => {
      live = false
    }
  }, [woken])

  const stopProgress = useCallback(() => {
    clearInterval(progressRef.current)
    progressRef.current = null
  }, [])
  const startProgress = useCallback(() => {
    clearInterval(progressRef.current)
    progressRef.current = window.setInterval(() => {
      const p = playerRef.current
      if (p && p.getCurrentTime) startTransition(() => setCurrentTime(p.getCurrentTime()))
    }, 100)
  }, [])
  useEffect(() => stopProgress, [stopProgress])

  useEffect(() => {
    if (!track || !apiReady) return
    startTransition(() => {
      setPlayerReady(false)
      setCurrentTime(0)
      setDuration(0)
    })
    const t = window.setTimeout(() => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch (e) {}
        playerRef.current = null
      }
      playerRef.current = new window.YT.Player(`youtube-player-${track.id}`, {
        videoId: track.id,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3, fs: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            startTransition(() => {
              setDuration(e.target.getDuration())
              setPlayerReady(true)
            })
            if (autoPlay.current) {
              e.target.playVideo()
              autoPlay.current = false
            }
          },
          onStateChange: (e) => {
            if (e.data === 1) {
              startTransition(() => setIsPlaying(true))
              startProgress()
            } else if (e.data === 2) {
              startTransition(() => setIsPlaying(false))
              stopProgress()
            } else if (e.data === 0) {
              if (repeatRef.current === 'one') e.target.seekTo(0, true)
              else nextRef.current()
            }
          },
        },
      })
    }, 50) // the target div has to be in the DOM first
    return () => {
      clearTimeout(t)
      stopProgress()
    }
  }, [trackIndex, track && track.id, apiReady, forcePlay]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      try {
        if (playerRef.current) playerRef.current.destroy()
      } catch (e) {}
    },
    [],
  )

  // ---------- transport
  const play = useCallback((index) => {
    autoPlay.current = true
    startTransition(() => {
      setTrackIndex(index)
      setIsPlaying(true)
      setMenu(['nowplaying'])
      setForcePlay((n) => n + 1)
    })
  }, [])

  const step = useCallback(
    (dir) => {
      const n = tracks.length
      if (!n) return
      let i
      if (shuffle) {
        i = Math.floor(Math.random() * n)
        if (n > 1) while (i === trackIndex) i = Math.floor(Math.random() * n)
      } else {
        i = trackIndex + dir
        if (i >= n) {
          if (repeat !== 'all') return
          i = 0
        }
        if (i < 0) i = repeat === 'all' ? n - 1 : 0
      }
      autoPlay.current = true
      startTransition(() => {
        setTrackIndex(i)
        setIsPlaying(true)
      })
    },
    [tracks.length, trackIndex, shuffle, repeat],
  )
  const next = useCallback(() => step(1), [step])
  const prev = useCallback(() => step(-1), [step])
  nextRef.current = next

  const togglePlay = useCallback(() => {
    const p = playerRef.current
    if (!p || !playerReady) return
    if (isPlaying) p.pauseVideo()
    else p.playVideo()
    startTransition(() => setIsPlaying(!isPlaying))
  }, [isPlaying, playerReady])

  const shuffleSongs = useCallback(() => {
    if (!tracks.length) return
    startTransition(() => setShuffle(true))
    play(Math.floor(Math.random() * tracks.length))
  }, [tracks.length, play])

  const go = useCallback((path) => {
    startTransition(() => {
      setMenu(path)
      setSelected(0)
    })
  }, [])

  const toggleBacklight = useCallback(() => {
    startTransition(() => {
      setBacklight(!backlight)
      setAutoBacklight(!backlight) // switching it off by hand also stops the auto backlight
    })
  }, [backlight])

  // ---------- menus
  const artists = useMemo(
    () => [...new Set(tracks.map((t) => (t.artist || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [tracks],
  )
  const menus = useMemo(() => {
    const m = {
      main: [
        { label: 'Music', action: () => go(['main', 'music']) },
        { label: 'Extras', action: () => {} },
        { label: 'Settings', action: () => go(['main', 'settings']) },
        { label: 'Shuffle Songs', action: shuffleSongs },
        { label: 'Backlight', action: toggleBacklight },
        ...(track ? [{ label: 'Now Playing', action: () => go(['nowplaying']) }] : []),
      ],
      music: [
        { label: 'All Songs', action: () => go(['main', 'music', 'allsongs']) },
        { label: 'Artists', action: () => go(['main', 'music', 'artists']) },
      ],
      settings: [
        { label: `Shuffle: ${shuffle ? 'On' : 'Off'}`, action: () => startTransition(() => setShuffle(!shuffle)) },
        {
          label: `Repeat: ${repeat === 'off' ? 'Off' : repeat === 'one' ? 'One' : 'All'}`,
          action: () => startTransition(() => setRepeat(repeat === 'off' ? 'one' : repeat === 'one' ? 'all' : 'off')),
        },
        { label: `Backlight: ${backlight ? 'On' : 'Off'}`, action: toggleBacklight },
        { label: `LCD Filter: ${lcdFilter ? 'On' : 'Off'}`, action: () => startTransition(() => setLcdFilter(!lcdFilter)) },
      ],
      allsongs: tracks.map((t, i) => ({ label: t.title, action: () => play(i) })),
      artists: artists.map((a) => ({ label: a, action: () => go(['main', 'music', 'artists', `artist-${a}`]) })),
      nowplaying: [],
    }
    artists.forEach((a) => {
      m[`artist-${a}`] = tracks
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => (t.artist || '').trim() === a)
        .map(({ t, i }) => ({ label: t.title, action: () => play(i) }))
    })
    return m
  }, [tracks, artists, track, shuffle, repeat, backlight, lcdFilter, go, play, shuffleSongs, toggleBacklight])

  const menuKey = menu[menu.length - 1]
  const items = menus[menuKey] || []
  const nowPlaying = menuKey === 'nowplaying'
  const title = nowPlaying
    ? 'Now Playing'
    : { main: 'iPod', music: 'Music', allsongs: 'All Songs', artists: 'Artists', settings: 'Settings' }[menuKey] ||
      (menuKey.startsWith('artist-') ? menuKey.slice(7) : 'iPod')

  // ---------- buttons
  const center = useCallback(() => {
    poke()
    if (nowPlaying) togglePlay() // music only: the centre button plays / pauses
    else if (items[selected]) items[selected].action()
  }, [poke, nowPlaying, togglePlay, items, selected])

  const menuButton = useCallback(() => {
    poke()
    if (nowPlaying) go(['main', 'music', 'allsongs'])
    else if (menu.length > 1) go(menu.slice(0, -1))
    else if (track) go(['nowplaying'])
  }, [poke, nowPlaying, menu, track, go])

  const up = useCallback(() => {
    if (nowPlaying) return
    poke()
    startTransition(() => setSelected((i) => Math.max(0, i - 1)))
  }, [nowPlaying, poke])
  const down = useCallback(() => {
    if (nowPlaying) return
    poke()
    startTransition(() => setSelected((i) => Math.min(items.length - 1, i + 1)))
  }, [nowPlaying, poke, items.length])

  // turning the wheel: menus move the selection, Now Playing seeks 5 s
  const rotate = useCallback(
    (delta) => {
      poke()
      if (!nowPlaying) return delta > 0 ? down() : up()
      const p = playerRef.current
      if (!p || !p.seekTo) return
      const t = Math.max(0, Math.min(duration, p.getCurrentTime() + (delta > 0 ? 5 : -5)))
      p.seekTo(t, true)
      startTransition(() => setCurrentTime(t))
    },
    [poke, nowPlaying, down, up, duration],
  )
  const rotateRef = useRef(rotate)
  rotateRef.current = rotate

  const angleOf = (e) => {
    const r = wheelRef.current.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
  }
  const onWheelDown = (e) => {
    poke()
    if (!wheelRef.current) return
    lastAngle.current = angleOf(e)
    const move = (ev) => {
      if (!wheelRef.current) return
      const a = angleOf(ev)
      let d = a - lastAngle.current
      if (d > Math.PI) d -= 2 * Math.PI
      if (d < -Math.PI) d += 2 * Math.PI
      if (Math.abs(d) > 0.05) {
        rotateRef.current(d)
        lastAngle.current = a
      }
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  // keyboard, only while the iPod has focus
  const onKeyDown = (e) => {
    const k = e.key
    if (k === 'ArrowLeft') nowPlaying ? prev() : up()
    else if (k === 'ArrowRight') nowPlaying ? next() : down()
    else if (k === 'ArrowUp') up()
    else if (k === 'ArrowDown') down()
    else if (k === 'Enter') center()
    else if (k === 'Escape') menuButton()
    else return
    e.preventDefault()
  }

  // ---------- battery "charging" animation
  useEffect(() => {
    const t = setInterval(() => startTransition(() => setBattery((b) => (b >= 4 ? 1 : b + 1))), 1500)
    return () => clearInterval(t)
  }, [])

  // keep the selected row in view (inside the menu box only)
  useEffect(() => {
    const box = scrollRef.current
    const row = box && box.children[selected]
    if (!row) return
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight
  }, [selected, menuKey])

  const scale = size === 'medium' ? 1.3 : size === 'large' ? 1.6 : 1

  // ---------- 3D: the iPod lies still at a fixed angle (it doesn't follow the cursor).
  // Written straight to the DOM.
  const body3d = useRef(null)
  const shadowRef = useRef(null)
  const glareRef = useRef(null)
  useEffect(() => {
    const body = body3d.current
    if (!body) return
    const { x: rx, y: ry } = REST
    body.style.transform = `${scale === 1 ? '' : `scale(${scale}) `}rotateX(${rx}deg) rotateY(${ry}deg)`
    // light from the top left: the shadow falls to the bottom right
    if (shadowRef.current)
      shadowRef.current.style.transform = `translate(${(16 - ry * 0.5).toFixed(1)}px, ${(14 + rx * 0.9).toFixed(1)}px) scale(${scale * 0.98})`
    if (glareRef.current) glareRef.current.style.backgroundPosition = `${(50 - ry * 4).toFixed(1)}% 0`
  }, [scale])

  const wake = () => woken || setWoken(true)

  const wheelButton = (pos, onClick, children, enabled = true) => (
    <button
      type="button"
      onClick={onClick}
      tabIndex={-1}
      style={{
        position: 'absolute',
        ...pos,
        background: 'transparent',
        border: 'none',
        padding: 4,
        cursor: enabled ? 'pointer' : 'default',
        opacity: enabled ? 1 : 0.5,
        textShadow: engrave,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  )
  const svg12 = (children) => (
    <svg width="12" height="12" viewBox="0 0 16 16" fill={glyph} aria-hidden>
      {children}
    </svg>
  )

  return (
    <div
      className="ipod"
      role="application"
      aria-label={`${ownerName ? `${ownerName}’s ` : ''}iPod. Turn the wheel or use the arrow keys, Enter to select, Esc for Menu.`}
      tabIndex={0}
      onMouseEnter={wake}
      onPointerDown={wake}
      onFocus={wake}
      onKeyDown={onKeyDown}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', outline: 'none', perspective: 760, ...style }}
    >
      <style>{IPOD_CSS(line)}</style>

      {/* shadow on the mat: a soft one that moves with the tilt, and a tight contact shadow */}
      <div ref={shadowRef} aria-hidden style={{ position: 'absolute', width: 200, height: 372, borderRadius: 26, background: 'rgba(0,0,0,.42)', filter: 'blur(16px)', pointerEvents: 'none' }} />
      <div aria-hidden style={{ position: 'absolute', width: 196, height: 368, borderRadius: 22, background: 'rgba(0,0,0,.3)', filter: 'blur(4px)', transform: `translate(6px, 8px) scale(${scale})`, pointerEvents: 'none' }} />

      <div ref={body3d} style={{ position: 'relative', width: 200, height: 372, transformStyle: 'preserve-3d' }}>
        {/* the sides: slices stacked behind the face. A few of white acrylic, then the polished steel back */}
        {SLICES.map((s, i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 20,
              transform: `translateZ(${-s.z}px)`,
              background: s.steel ? STEEL : theme === 'classic' ? ACRYLIC : 'linear-gradient(135deg, #3a3a3a, #111 60%, #2a2a2a)',
              pointerEvents: 'none',
            }}
          />
        ))}

      {/* device face */}
      <div
        style={{
          width: 200,
          height: 372, // 15 + screen 140 + 15 + wheel 170 + 32 below the wheel
          boxSizing: 'border-box',
          background:
            theme === 'classic'
              ? 'linear-gradient(160deg, #ffffff 0%, #f7f7f7 55%, #ececec 100%)'
              : theme === 'u2'
                ? 'linear-gradient(145deg, #1a1a1a, #000000)'
                : 'linear-gradient(145deg, #2a2a2a, #0a0a0a)',
          borderRadius: 20,
          padding: 15,
          display: 'flex',
          flexDirection: 'column',
          gap: 15,
          // a bevelled edge: bright lip on top, a soft roll-off at the bottom
          boxShadow: `inset 0 1.5px 1px rgba(255,255,255,${theme === 'classic' ? 1 : 0.18}), inset 0 -2px 3px rgba(0,0,0,${theme === 'classic' ? 0.1 : 0.4}), inset 0 0 0 1px ${theme === 'classic' ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)'}`,
          position: 'relative',
          transform: 'translateZ(0.5px)',
        }}
      >
        {/* glare across the face, sliding with the tilt */}
        <div
          ref={glareRef}
          aria-hidden
          style={{
            ...fill,
            borderRadius: 20,
            pointerEvents: 'none',
            zIndex: 200,
            backgroundImage: 'linear-gradient(115deg, transparent 32%, rgba(255,255,255,.38) 46%, rgba(255,255,255,.08) 54%, transparent 64%)',
            backgroundSize: '300% 100%',
            mixBlendMode: 'screen',
          }}
        />

        {/* screen */}
        <div
          data-ipod-nodrag=""
          style={{
            width: '100%',
            height: 140,
            flex: 'none',
            boxSizing: 'border-box',
            background: backlight ? 'linear-gradient(to bottom, #d1e8fa, #e0f0fc)' : 'linear-gradient(to bottom, #a0a8a0, #b8c0b8)',
            borderRadius: 8,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid #8c8c8c',
            // set into the face: a dark rim and a light lip just below it
            boxShadow: `0 1px 0 rgba(255,255,255,${theme === 'classic' ? 0.95 : 0.12}), 0 -1px 0 rgba(0,0,0,0.12)`,
          }}
        >
          {/* YouTube player: audio only, never shown (the screen shows the music player UI) */}
          {track && (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 20,
                left: 0,
                width: '100%',
                height: 'calc(100% - 20px)',
                zIndex: -1,
                pointerEvents: 'none',
                opacity: 0,
              }}
            >
              <div id={`youtube-player-${track.id}`} style={{ width: '100%', height: '100%' }} />
            </div>
          )}

          {/* boot screen */}
          <div
            style={{
              ...fill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: ink,
              pointerEvents: 'none',
              zIndex: 90,
              opacity: booted ? 0 : 1,
              transition: 'opacity 0.5s ease',
              fontSize: 12,
              fontWeight: 700,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {ownerName ? `${ownerName}’s iPod` : 'iPod'}
          </div>

          {/* inner shadow, always on top */}
          <div
            style={{
              ...fill,
              borderRadius: 7,
              pointerEvents: 'none',
              zIndex: 100,
              boxShadow:
                'inset 0 3px 5px rgba(0,0,0,0.28), inset 0 0 8px rgba(0,0,0,0.1), inset 0 -1px 2px rgba(255,255,255,0.25), inset 2px 0 3px rgba(0,0,0,0.08), inset -2px 0 3px rgba(0,0,0,0.08)',
            }}
          />
          {lcdFilter && (
            <>
              <div
                style={{
                  ...fill,
                  background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.06) 0px, transparent 1px, transparent 2px)',
                  pointerEvents: 'none',
                  zIndex: 95,
                }}
              />
              <div
                style={{
                  ...fill,
                  bottom: 'auto',
                  height: '30%',
                  background: 'linear-gradient(to bottom, rgba(255,255,255,0.2), transparent)',
                  pointerEvents: 'none',
                  zIndex: 96,
                }}
              />
            </>
          )}

          {/* screen content */}
          <div
            style={{
              width: '100%',
              height: '100%',
              color: ink,
              fontSize: 10,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: lcd,
              opacity: booted ? 1 : 0,
              pointerEvents: booted ? 'auto' : 'none',
              transition: 'opacity 0.5s ease',
              ...font,
            }}
          >
            {/* title bar */}
            <div
              style={{
                height: 20,
                flex: 'none',
                borderBottom: `1px solid ${line}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ width: 20, paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill={ink} aria-hidden>
                  {isPlaying ? <polygon points="0,0 8,4 0,8" /> : <><rect x="0" y="0" width="3" height="8" /><rect x="5" y="0" width="3" height="8" /></>}
                </svg>
              </div>
              <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
              <div style={{ width: 24, display: 'flex', justifyContent: 'flex-end', paddingRight: 8 }}>
                <div
                  style={{
                    width: 19,
                    height: 10,
                    boxSizing: 'border-box',
                    border: `1px solid ${line}`,
                    borderRadius: 2,
                    position: 'relative',
                    display: 'flex',
                    padding: 1,
                    gap: 1,
                  }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{ flex: 1, background: i < battery ? line : 'transparent', transition: 'background-color 0.2s ease' }} />
                  ))}
                  <div style={{ position: 'absolute', right: -3, top: '50%', transform: 'translateY(-50%)', width: 2, height: 4, background: line, borderRadius: '0 1px 1px 0' }} />
                </div>
              </div>
            </div>

            {nowPlaying && track ? (
              <div style={{ width: '100%', flex: 1, position: 'relative' }}>
                {!playerReady && (
                  /* loading: the Now Playing layout itself, with a stepped LCD bar sweeping through the
                     progress track, so the screen doesn't jump when the song starts */
                  <div role="status" aria-label={`Loading ${track.title}`} style={{ ...fill, display: 'flex', flexDirection: 'column', background: lcd, zIndex: 15 }}>
                    <div style={{ padding: '4px 8px', fontSize: 9 }}>
                      {trackIndex + 1} of {tracks.length}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '0 8px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                      <div style={{ fontSize: 11 }}>{track.artist || 'Unknown Artist'}</div>
                    </div>
                    <div style={{ padding: '0 8px 8px' }}>
                      <LcdLoader line={line} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
                        <span>Loading</span>
                        <span>--:--</span>
                      </div>
                    </div>
                  </div>
                )}
                {playerReady && (
                  <div style={{ ...fill, display: 'flex', flexDirection: 'column', background: lcd, zIndex: 10 }}>
                    <div style={{ padding: '4px 8px', fontSize: 9 }}>
                      {trackIndex + 1} of {tracks.length}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: '0 8px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{track.title}</div>
                      <div style={{ fontSize: 11 }}>{track.artist || 'Unknown Artist'}</div>
                    </div>
                    <div style={{ padding: '0 8px 8px' }}>
                      <div style={{ height: 8, boxSizing: 'border-box', border: `1px solid ${line}`, borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
                            background: line,
                            borderRadius: 3,
                            transition: 'width 0.1s linear',
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 9, fontVariantNumeric: 'tabular-nums' }}>
                        <span>{fmt(currentTime)}</span>
                        <span>-{fmt(Math.max(0, duration - currentTime))}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div ref={scrollRef} className="ipod-menu" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
                {items.map((item, i) => (
                  <div
                    key={i}
                    className={i === selected ? 'ipod-row is-on' : 'ipod-row'}
                    onClick={() => {
                      poke()
                      startTransition(() => setSelected(i))
                      item.action()
                    }}
                    style={{
                      padding: '4px 8px',
                      background: i === selected ? line : undefined,
                      color: i === selected ? (backlight ? '#c5e0f5' : '#d0d8d0') : ink,
                      '--ipod-hover': backlight ? '#c0d8f0' : '#7a827a',
                      cursor: 'pointer',
                      fontSize: 12,
                      textShadow: textShadow ? '1px 1px 0 rgba(0,0,0,0.15)' : 'none',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* click wheel */}
        <div
          ref={wheelRef}
          data-ipod-nodrag=""
          onPointerDown={onWheelDown}
          style={{
            width: 170,
            height: 170,
            flex: 'none',
            borderRadius: '50%',
            // concave: darker towards the top rim, lighter where the bottom catches the light
            background:
              theme === 'classic'
                ? 'radial-gradient(circle at 50% 62%, #f1f1f1 0%, #e2e2e2 48%, #cfcfcf 78%, #c4c4c4 100%)'
                : theme === 'u2'
                  ? 'radial-gradient(circle at 50% 62%, #d22a46 0%, #a8142c 60%, #7a0012 100%)'
                  : 'radial-gradient(circle at 50% 62%, #444 0%, #2c2c2c 60%, #161616 100%)',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            touchAction: 'none',
            boxShadow: `inset 0 4px 7px rgba(0,0,0,0.2), inset 0 -2px 3px rgba(255,255,255,${theme === 'classic' ? 0.9 : 0.12}), 0 1px 0 rgba(255,255,255,${theme === 'classic' ? 0.95 : 0.1}), 0 -1px 1px rgba(0,0,0,0.12)`,
          }}
        >
          <div
            style={{
              ...fill,
              borderRadius: '50%',
              pointerEvents: 'none',
              background: `conic-gradient(from 0deg, ${theme === 'classic' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'} 0deg, transparent 90deg, ${theme === 'classic' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.3)'} 180deg, transparent 270deg, ${theme === 'classic' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'} 360deg)`,
            }}
          />
          {wheelButton(
            { top: 11, left: '50%', transform: 'translateX(-50%)' },
            menuButton,
            <svg width="32" height="12" viewBox="0 0 32 12" fill={glyph} aria-label="Menu">
              <text x="16" y="9" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="system-ui, -apple-system, sans-serif">
                MENU
              </text>
            </svg>,
          )}
          {wheelButton(
            { right: 11, top: '50%', transform: 'translateY(-50%)' },
            () => (poke(), nowPlaying ? next() : down()),
            svg12(<><polygon points="0,2 6,8 0,14" /><polygon points="6,2 12,8 6,14" /><rect x="13" y="2" width="2" height="12" /></>),
          )}
          {wheelButton(
            { bottom: 11, left: '50%', transform: 'translateX(-50%)' },
            nowPlaying ? () => (poke(), togglePlay()) : undefined,
            svg12(isPlaying ? <><rect x="3" y="2" width="4" height="12" /><rect x="9" y="2" width="4" height="12" /></> : <polygon points="4,2 14,8 4,14" />),
            nowPlaying,
          )}
          {wheelButton(
            { left: 11, top: '50%', transform: 'translateY(-50%)' },
            () => (poke(), nowPlaying ? prev() : up()),
            svg12(<><rect x="1" y="2" width="2" height="12" /><polygon points="10,2 4,8 10,14" /><polygon points="16,2 10,8 16,14" /></>),
          )}

          {/* centre button */}
          <button
            type="button"
            tabIndex={-1}
            aria-label="Select"
            onClick={center}
            className="ipod-center"
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              // domed: highlight top left, shading towards the bottom
              background:
                theme === 'classic'
                  ? 'radial-gradient(circle at 38% 30%, #ffffff 0%, #f6f6f6 35%, #e4e4e4 75%, #d2d2d2 100%)'
                  : theme === 'u2'
                    ? 'radial-gradient(circle at 38% 30%, #3a3a3a, #141414 70%, #050505)'
                    : 'radial-gradient(circle at 38% 30%, #5a5a5a, #2e2e2e 70%, #1c1c1c)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              boxShadow: `0 0 0 1px ${theme === 'classic' ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.1)'}, 0 3px 5px rgba(0,0,0,0.22), 0 1px 1px rgba(0,0,0,0.18), inset 0 -2px 3px rgba(0,0,0,0.1), inset 0 1px 0 ${theme === 'classic' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.12)'}`,
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: '10%',
                left: '10%',
                right: '10%',
                height: '40%',
                borderRadius: '50%',
                pointerEvents: 'none',
                background:
                  theme === 'classic' ? 'linear-gradient(to bottom, rgba(255,255,255,0.6), transparent)' : 'linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)',
              }}
            />
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}

const IPOD_CSS = (line) => `
.ipod:focus-visible { outline: 2px solid #fff; outline-offset: 6px; border-radius: 24px; }
.ipod-center { transition: translate .08s ease, box-shadow .08s ease; }
.ipod-center:active { translate: 0 1px; box-shadow: 0 0 0 1px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.2), inset 0 1px 3px rgba(0,0,0,.12) !important; }
.ipod-row:not(.is-on):hover { background: var(--ipod-hover); }
.ipod-menu::-webkit-scrollbar { width: 4px; }
.ipod-menu::-webkit-scrollbar-track { background: transparent; box-shadow: inset 1px 0 0 ${line}80, inset -1px 0 0 ${line}80; }
.ipod-menu::-webkit-scrollbar-thumb { background: ${line}; border-radius: 0; }
`

/* The loading bar: the same 8px track as the progress bar, with a block of lit LCD segments
 * sweeping through it in steps. Driven by a timer, not a CSS animation: the phone rewrites styles in
 * this layer every frame, which keeps restarting CSS animations here. */
const SEGS = 14
const LIT = 4
function LcdLoader({ line }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    const slow = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = window.setInterval(() => setT((v) => v + 1), slow ? 400 : 90)
    return () => window.clearInterval(id)
  }, [])
  const head = t % (SEGS + LIT) // the block enters on the left and leaves on the right
  return (
    <div style={{ height: 8, boxSizing: 'border-box', border: `1px solid ${line}`, borderRadius: 4, padding: 1, display: 'flex', gap: 1, overflow: 'hidden' }}>
      {Array.from({ length: SEGS }, (_, i) => {
        const on = i < head && i >= head - LIT
        return <div key={i} style={{ flex: 1, borderRadius: 1, background: line, opacity: on ? (i === head - 1 ? 1 : 0.55 + 0.15 * (i - head + LIT)) : 0.08 }} />
      })}
    </div>
  )
}
