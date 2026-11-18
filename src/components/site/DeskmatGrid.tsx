import { useEffect, useRef, useState } from 'react'

/* The surface behind the phone: a precision-grid desk mat (cutting-mat style).
 * - a fine square grid with a stronger line every 5 squares (CSS gradients, always crisp)
 * - ruler ticks along all four edges, numbered every major line, like a mat's measured border
 * - 30° / 45° / 60° angle guides from the bottom-left corner and a small registration mark
 * Quiet ink on the page's off-white, so the phone stays the focus. Rendered in Foldfolio's
 * `backdrop` slot; it fills the stage and redraws its ruler on resize. */

const UNIT = 16 // one grid square, px
const MAJOR = 5 // a major line every 5 squares (80px), numbered on the rulers
const TOP = 44 // top ruler sits just under the fixed nav
const BOTTOM = 40 // bottom ruler sits just above the fixed footer
const BOTTOM_PHONE = 76 // phones: the footer wraps to two lines, so the ruler sits higher
const INK = '17,17,17'

export default function DeskmatGrid() {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setSize((s) => (Math.round(width) === s.w && Math.round(height) === s.h ? s : { w: Math.round(width), h: Math.round(height) }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { w, h } = size
  const top = TOP
  const bottom = h - (w < 810 ? BOTTOM_PHONE : BOTTOM)
  const ticks: string[] = []
  const labels: { x: number; y: number; t: string; a?: 'end' | 'start' | 'middle' }[] = []

  if (w && h) {
    // horizontal rulers (top + bottom): a tick every square, longer on half and major lines
    for (let i = 0, x = 0; x <= w; i++, x = i * UNIT) {
      const len = i % MAJOR === 0 ? 10 : i % MAJOR === 2 || i % MAJOR === 3 ? 4 : 6
      ticks.push(`M${x} ${top}v${len}M${x} ${bottom}v${-len}`)
      if (i % MAJOR === 0 && i) labels.push({ x: x + 3, y: top + 18, t: String(i / MAJOR), a: 'start' })
    }
    // vertical rulers (left + right), measured from the top ruler
    for (let i = 0, y = top; y <= bottom; i++, y = top + i * UNIT) {
      const len = i % MAJOR === 0 ? 10 : 5
      ticks.push(`M0 ${y}h${len}M${w} ${y}h${-len}`)
      if (i % MAJOR === 0 && i) labels.push({ x: 14, y: y + 3, t: String(i / MAJOR), a: 'start' })
    }
  }

  // angle guides from the bottom-left corner of the measured area
  const reach = Math.hypot(w, h)
  const guide = (deg: number) => {
    const r = (deg * Math.PI) / 180
    return `M0 ${bottom}L${(Math.cos(r) * reach).toFixed(1)} ${(bottom - Math.sin(r) * reach).toFixed(1)}`
  }

  return (
    <div
      ref={box}
      className="deskmat"
      aria-hidden
      style={{
        backgroundImage: [
          `linear-gradient(rgba(${INK},.085) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(${INK},.085) 1px, transparent 1px)`,
          `linear-gradient(rgba(${INK},.04) 1px, transparent 1px)`,
          `linear-gradient(90deg, rgba(${INK},.04) 1px, transparent 1px)`,
        ].join(','),
        backgroundSize: `${UNIT * MAJOR}px ${UNIT * MAJOR}px, ${UNIT * MAJOR}px ${UNIT * MAJOR}px, ${UNIT}px ${UNIT}px, ${UNIT}px ${UNIT}px`,
        backgroundPosition: `0 ${top}px`,
      }}
    >
      {w > 0 && (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* measured border */}
          <path d={`M0 ${top}H${w}M0 ${bottom}H${w}`} stroke={`rgba(${INK},.22)`} strokeWidth="1" shapeRendering="crispEdges" />
          <path d={ticks.join('')} stroke={`rgba(${INK},.32)`} strokeWidth="1" shapeRendering="crispEdges" />
          {/* angle guides */}
          <g stroke={`rgba(${INK},.09)`} strokeWidth="1" strokeDasharray="2 5" fill="none">
            <path d={guide(30)} />
            <path d={guide(45)} />
            <path d={guide(60)} />
          </g>
          <g fill={`rgba(${INK},.38)`} fontSize="9" fontFamily="var(--font)" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {[30, 45, 60].map((d) => {
              const r = (d * Math.PI) / 180
              return (
                <text key={d} x={(Math.cos(r) * 150).toFixed(1)} y={(bottom - Math.sin(r) * 150).toFixed(1)}>
                  {d}°
                </text>
              )
            })}
            {labels.map((l, i) => (
              <text key={i} x={l.x} y={l.y} textAnchor={l.a}>
                {l.t}
              </text>
            ))}
          </g>
          {/* registration mark, top-right */}
          <g stroke={`rgba(${INK},.3)`} strokeWidth="1" fill="none" transform={`translate(${w - 56} ${top + 40})`}>
            <circle r="9" />
            <path d="M-14 0H14M0 -14V14" />
          </g>
        </svg>
      )}
    </div>
  )
}
