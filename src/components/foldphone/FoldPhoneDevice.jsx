// FoldPhone Device: the foldable phone that holds the whole site. Started as the FoldPhone
// Framer template's component; changes for this site are marked [Z8] (Galaxy Z Fold 8 / Z Flip 8
// shapes, cameras, real 3D thickness, pointer tilt). Trimmed to what this site uses: no Framer
// editor, the Basic background only, fold mode only. Configure it through FoldPhone.jsx.
//
// How it works
// - Scroll opens the device, scrolls the Screen content, folds it shut and shows the Call
//   screen on the cover.
// - Landscape (book fold) on wide screens, Portrait (flip fold) on phones & tall screens.
//   Screen content is laid out at 976 px (landscape) and 358 px (portrait) wide.

import { indiaHHMM } from "../site/indiaTime" // [Z8]
import * as React from "react"
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    startTransition,
} from "react"

// ---------------------------------------------------------------- constants

// Four finishes, Samsung's colours: [base, shade, highlight, deep]
const FINISHES = {
    pistachio: { label: "Pistachio", c: ["#B4C8BF", "#7E978C", "#DCE7E2", "#56695F"] },
    lavender: { label: "Lavender", c: ["#BFB9D0", "#8B84A3", "#E2DEEC", "#625C7A"] },
    graphite: { label: "Graphite", c: ["#5D6064", "#36383B", "#8B8E92", "#1D1F21"] },
    cream: { label: "Cream", c: ["#EEEDE9", "#BDBAB3", "#FBFAF8", "#8A867E"] },
}
const FINISH_KEYS = ["pistachio", "lavender", "graphite", "cream"]

// Device geometry in design pixels. Screen = W - 2*(f+bz).
// [Z8] Landscape = Galaxy Z Fold 8: a near-square open display, tall narrow cover, tight corners.
//      Screen 976 x 916 (two halves of 488).
// [Z8] Portrait = Galaxy Z Flip 8: a tall 22:9 display that folds to a near-square, rounder corners.
//      Screen 358 x 823 (two halves of ~400).
// T = thickness of one half, drawn as a real 3D side edge while a half turns.
const GEO = {
    landscape: { W: 1000, H: 940, f: 4, bz: 8, T: 22, R: 20 }, // [Z8] tighter corners (was 34; original 46)
    portrait: { W: 380, H: 845, f: 4, bz: 7, T: 26, R: 28 }, // [Z8] tighter corners (was 46; original 42)
}
// [Z8] how much of the body's metal side shows under the device at rest (design px)
const EDGE = 7

// Page CSS: no backdrop blur inside the device (keeps scrolling smooth), and hover styles for
// links in the screen (the scan marks pill buttons .ffh-b, wide rows .ffh-r).
const EASE = "cubic-bezier(.16,1,.3,1)"
const PAGE_CSS = `
.ffm-lite *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.ff-backdrop{height:100lvh!important}
@media (hover: hover) and (pointer: fine){
.ffm-hover .ffh-b{transition:translate .45s ${EASE},filter .45s ease,box-shadow .45s ease}
.ffm-hover .ffh-b:hover{translate:0 -3px;filter:brightness(1.1);box-shadow:0 14px 26px -14px rgba(0,0,0,.5)}
.ffm-hover .ffh-b:active{translate:0 0;filter:brightness(.95)}
.ffm-hover .ffh-r{transition:translate .5s ${EASE},opacity .4s ease}
.ffm-hover .ffh-r:hover{translate:8px 0;opacity:.72}
}
`

// [Z8] intro decision for this page load (see the opening-animation effect)
let ffLoad = null

const STORE_KEY = "foldphone:style"
const STORE_EVENT = "foldphone:style"

// ---------------------------------------------------------------- helpers

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
const eio = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const mixHex = (a, b, t) => {
    const p = (h) => {
        const s = h.replace("#", "")
        const n = parseInt(
            s.length === 3
                ? s
                      .split("")
                      .map((x) => x + x)
                      .join("")
                : s.slice(0, 6),
            16
        )
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const x = p(a),
        y = p(b)
    const c = x.map((v, i) => Math.round(v + (y[i] - v) * t))
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("")
}
// relative luminance (0 dark … 1 light) of a "#rrggbb" colour
const hexLum = (hex) => {
    const n = parseInt(hex.slice(1, 7), 16) || 0
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
}
function readStore() {
    try {
        return JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}")
    } catch (e) {
        return {}
    }
}
function first(node) {
    const arr = React.Children.toArray(node)
    return arr[0] || null
}
// Render a connected frame at the width we decide (height stays the frame's own).
function Slot({
    node,
    width,
    style,
}
) {
    if (!node) return null
    const s = (node.props && node.props.style) || {}
    return React.cloneElement(node, {
        style: {
            ...s,
            position: "relative",
            left: 0,
            top: 0,
            width: width === undefined ? s.width : width,
            ...style,
        },
    })
}

/* Where the phone sits on the stage, for a viewport { w, h } (w = the device's own width).
 * Exported so things placed on the desk mat (see src/components/desk/) can keep clear of it.
 * left/top/width/height is the fully unfolded phone, which also covers the closed one. */
export function deviceFrame(vp, layout, switcher) {
    const port = vp.w < layout.portraitBelow || vp.w / vp.h < 0.85
    const G = port ? GEO.portrait : GEO.landscape
    const availH = Math.max(
        200,
        vp.h - layout.top - Math.max(layout.bottom, switcher.bottom + 64)
    )
    const availW = vp.w * (port ? 0.94 : 0.9)
    const s = Math.min(availW / G.W, availH / G.H, layout.maxScale)
    // the hinge sits on whole screen pixels (no blurred seam between the two halves)
    const cy = Math.round(layout.top + availH / 2)
    const cx = Math.round(vp.w / 2)
    const width = G.W * s
    const height = G.H * s
    return { port, G, s, cx, cy, left: cx - width / 2, top: cy - height / 2, width, height }
}

// ---------------------------------------------------------------- component

const easeOut = (p) => 1 - Math.pow(1 - p, 3)

export default function FoldPhoneDevice(props) {
    const { finish: finishProp, screenColor, switcher, layout, motion, intro } = props

    // ---------- viewport + orientation
    const rootRef = useRef(null)
    const [vp, setVp] = useState({ w: 1200, h: 820 })
    useLayoutEffect(() => {
        const measure = () => {
            const w = rootRef.current
                ? rootRef.current.offsetWidth || window.innerWidth
                : window.innerWidth
            const h = window.innerHeight
            startTransition(() =>
                setVp((p) => {
                    // ignore small height-only jumps (mobile address bar) to avoid layout jumps
                    if (p.w === w && Math.abs(p.h - h) < 110 && w < 900)
                        return p
                    return p.w === w && p.h === h ? p : { w, h }
                })
            )
        }
        measure()
        window.addEventListener("resize", measure)
        const ro =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(measure)
                : null
        if (ro && rootRef.current) ro.observe(rootRef.current)
        return () => {
            window.removeEventListener("resize", measure)
            if (ro) ro.disconnect()
        }
    }, [])

    const { port, G, s, cx, cy } = deviceFrame(vp, layout, switcher)
    const b = G.f + G.bz
    const Ws = G.W - 2 * b // full screen width
    const Hs = G.H - 2 * b // full screen height
    const halfW = port ? Ws : G.W / 2 - b // one half-screen
    const halfH = port ? G.H / 2 - b : Hs
    const land = !port
    const rad = (tl, tr, br, bl) =>
        `${tl}px ${tr}px ${br}px ${bl}px`
    const Ro = G.R
    // corners per piece: outer corners rounded, hinge side square (the halves meet there)
    const cLeaf = land ? rad(Ro, 0, 0, Ro) : rad(Ro, Ro, 0, 0)
    const cRight = land ? rad(0, Ro, Ro, 0) : rad(0, 0, Ro, Ro)
    const cAll = rad(Ro, Ro, Ro, Ro)
    const inner = (r, off) =>
        r
            .split(" ")
            .map((v) =>
                parseFloat(v) > 0
                    ? Math.max(0, parseFloat(v) - off) + "px"
                    : "0px"
            )
            .join(" ")

    // ---------- frame finish, remembered across visits through localStorage
    const [finish, setFinish] = useState(finishProp)
    useEffect(() => {
        const sync = () => {
            const s = readStore()
            // a pick saved before the colours changed (e.g. "coral") falls back to the default
            startTransition(() => setFinish(FINISHES[s.finish] ? s.finish : finishProp))
        }
        sync()
        window.addEventListener(STORE_EVENT, sync)
        window.addEventListener("storage", sync)
        return () => {
            window.removeEventListener(STORE_EVENT, sync)
            window.removeEventListener("storage", sync)
        }
    }, [finishProp])
    const choose = (fk) => {
        setFinish(fk)
        try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify({ finish: fk }))
            window.dispatchEvent(new Event(STORE_EVENT))
        } catch (e) {}
    }
    const F = (FINISHES[finish] || FINISHES[FINISH_KEYS[0]]).c

    // ---------- scale to fit the stage (see deviceFrame below the component)
    const stageH = vp.h

    // ---------- slots (the portrait variants are used on phones when given)
    const screenNode = first(
        port && first(props.screenPortrait)
            ? props.screenPortrait
            : props.screen
    )
    const coverNode = first(
        port && first(props.coverPortrait) ? props.coverPortrait : props.cover
    )
    const callNode = first(props.call)
    const navNode = first(props.nav)

    // ---------- measure the Screen content height
    const measureRef = useRef(null)
    const [contentH, setContentH] = useState(Hs)
    // the stage gets the page's own background colour: an opaque stage lets the browser skip
    // drawing the page underneath it (less graphics memory, no half-drawn frames)
    const [pageBg, setPageBg] = useState("")
    useEffect(() => {
        if (!rootRef.current) return
        let el = rootRef.current.parentElement
        let bg = ""
        while (el) {
            const c = window.getComputedStyle(el).backgroundColor
            const m = c.match(/[\d.]+/g)
            if (m && (m.length < 4 || +m[3] >= 0.99)) {
                bg = c
                break
            }
            el = el.parentElement
        }
        startTransition(() => setPageBg(bg || "#ffffff"))
    }, [])
    useEffect(() => {
        const el = measureRef.current
        if (!el) return
        const upd = () => {
            const h = el.offsetHeight
            startTransition(() =>
                setContentH((p) => (p === (h || Hs) ? p : h || Hs))
            )
        }
        upd()
        // images and CMS content can settle late: measure again a few times
        const ts = [200, 800, 2000].map((d) => window.setTimeout(upd, d))
        const ro =
            typeof ResizeObserver !== "undefined"
                ? new ResizeObserver(upd)
                : null
        if (ro) ro.observe(el)
        return () => {
            ts.forEach((t) => window.clearTimeout(t))
            if (ro) ro.disconnect()
        }
    }, [Hs, port])
    const innerMax = Math.max(0, contentH - Hs)

    // ---------- scroll phases (page pixels): open, scroll the content, close, hold
    const U1 = stageH * motion.openLength
    const U2 = stageH * motion.closeLength
    const U3 = stageH * motion.holdLength
    const innerPx = innerMax * s // scroll distance that moves the content at natural speed
    const totalH = stageH + U1 + innerPx + U2 + U3

    // ---------- the animation loop (direct DOM writes, no re-render per frame)
    const R = {
        stage: useRef(null),
        iCur: useRef(null),
        iA: useRef(null),
        iB: useRef(null),
        iSeam: useRef(null),
        iDev: useRef(null),
        dev: useRef(null),
        leaf: useRef(null),
        cover: useRef(null),
        rightH: useRef(null),
        rBody: useRef(null),
        rGlass: useRef(null),
        rScreen: useRef(null),
        cL: useRef(null),
        cR: useRef(null),
        shF: useRef(null),
        shB: useRef(null),
        shR: useRef(null),
        shadow: useRef(null),
        shadowC: useRef(null),
        call: useRef(null),
        overlay: useRef(null),
        rig: useRef(null),
        wA: useRef(null),
        plateL: useRef(null), // [Z8]
        plateR: useRef(null), // [Z8]
        caps: useRef(null), // [Z8] hinge end caps
    }

    const geo = useRef(null)
    geo.current = {
        port,
        G,
        s,
        U1,
        U2,
        U3,
        innerMax,
        innerPx,
        stageH,
        vw: vp.w,
        cy,
        halfW,
        halfH,
        Hs,
        cRight,
        cAll,
        inner,
    }

    // Write a style only when it changes (keeps the browser from re-doing work every frame)
    const cache = useRef(new WeakMap())
    const S = (el, k, v) => {
        if (!el) return
        let c = cache.current.get(el)
        if (!c) cache.current.set(el, (c = {}))
        if (c[k] !== v) {
            c[k] = v
            if (k.charCodeAt(0) === 45) el.style.setProperty(k, v)
            else el.style[k] = v
        }
    }
    const live = useRef({ k: -1, inner: -1, cur: 0, tint: "", bars: null, rc: "", pe: 0 })
    const tintMap = useRef([])
    // top-strip brightness of screen images (for the status bar over an image)
    const imgLum = useRef({})
    const topRef = useRef(0)
    const kick = useRef(() => {})
    // after every React render: forget cached styles and redraw once with the new geometry
    useLayoutEffect(() => {
        cache.current = new WeakMap()
        live.current.k = -1
        live.current.inner = -1
        live.current.tint = ""
        live.current.bars = null
        live.current.rc = ""
        renderFrame.current(live.current.cur, performance.now())
        kick.current()
    })
    const renderFrame = useRef(() => {})
    renderFrame.current = (sc, t) => {
        const g = geo.current
        const { G: Gd, port: P } = g
        const p1 = g.U1 > 0 ? clamp(sc / (g.U1 * 0.9), 0, 1) : 1
        const inner = clamp((sc - g.U1) / (g.s || 1), 0, g.innerMax)
        const p3 =
            g.U2 > 0
                ? clamp((sc - g.U1 - g.innerPx - g.U2 * 0.08) / (g.U2 * 0.92), 0, 1)
                : 0
        const pe = eio(p1) * (1 - eio(p3)) // 1 = fully open
        const k = +(1 - pe).toFixed(4) // 1 = fully closed
        const th = 180 * k
        const sn = Math.sin((th * Math.PI) / 180)
        const fl = motion.float && k > 0 ? Math.sin(t / 1500) * 5 * k : 0
        const flat = k < 0.003 // (almost) fully open: leave 3D mode (much lighter to draw)
        const L = live.current
        const kChanged = L.k !== k
        L.k = k
        L.pe = pe

        // ---- device (only when the fold state or the idle float changes)
        if (kChanged || fl) {
            // closed: slide so the closed phone sits in the middle (plain 2D move)
            S(
                R.dev.current,
                "transform",
                flat
                    ? "none"
                    : P
                      ? `translate(0px, ${((-k * Gd.H) / 4 + fl).toFixed(2)}px)`
                      : `translate(${((-k * Gd.W) / 4).toFixed(2)}px, ${fl.toFixed(2)}px)`
            )
        }
        if (kChanged) {
            const PP = P ? 2800 : 2100 // [Z8] Fold: closer camera = deeper 3D turn. Flip keeps the original 2800
            const front = th < 90
            const leaf = R.leaf.current,
                cover = R.cover.current
            // left half: visible until it is edge-on, then the cover takes over
            S(leaf, "visibility", front ? "visible" : "hidden")
            S(
                leaf,
                "transform",
                th < 0.2
                    ? "none"
                    : `perspective(${PP}px) ${P ? `rotateX(${(-th).toFixed(3)}deg)` : `rotateY(${th.toFixed(3)}deg)`}`
            )
            S(cover, "visibility", front ? "hidden" : "visible")
            // [Z8] hinge caps only once the left half has swung past upright: before that the cover
            // still lies over the right half and they'd stick out of the spine as little tabs
            S(R.caps.current, "visibility", front ? "inherit" : "hidden")
            S(
                cover,
                "transform",
                th > 179.8
                    ? "none"
                    : `perspective(${PP}px) ${P ? `rotateX(${(180 - th).toFixed(3)}deg)` : `rotateY(${(th - 180).toFixed(3)}deg)`}`
            )
            // right half is fully covered when closed: skip drawing it
            S(R.rightH.current, "visibility", th > 176 ? "hidden" : "visible")
            // right half: hinge corners square while the left half lies next to it, rounded
            // while the cover is on top of it (otherwise they would peek out around the cover)
            const rc = front ? g.cRight : g.cAll
            if (L.rc !== rc) {
                L.rc = rc
                S(R.rBody.current, "borderRadius", rc)
                S(R.plateR.current, "borderRadius", rc) // [Z8]
                S(R.rGlass.current, "borderRadius", g.inner(rc, Gd.f))
                S(R.rScreen.current, "borderRadius", g.inner(rc, Gd.f + Gd.bz))
                S(R.shR.current, "borderRadius", rc)
            }
            const hide = k > 0.985 ? "hidden" : "inherit"
            S(R.cL.current, "visibility", hide)
            S(R.cR.current, "visibility", hide)
            // shading while it turns (fades out quickly near open)
            const a = th / 90
            S(
                R.shF.current,
                "opacity",
                String(front ? +(Math.pow(a, 1.6) * 0.8).toFixed(3) : 0)
            )
            S(
                R.shB.current,
                "opacity",
                String(!front ? +(Math.pow(2 - a, 1.6) * 0.7).toFixed(3) : 0)
            )
            S(
                R.shR.current,
                "opacity",
                String(+(Math.pow(sn, 1.8) * 0.5).toFixed(3))
            )
            // nav + status overlay only when the device is flat open
            const o = clamp((pe - 0.975) * 40, 0, 1)
            S(R.overlay.current, "opacity", String(+o.toFixed(3)))
            S(R.overlay.current, "visibility", o > 0.01 ? "visible" : "hidden")
            // floor shadows (transform only)
            const vis = P ? 1 : 0.5 + 0.5 * pe
            const tx = P ? 0 : (Gd.W / 4) * k
            const sh = `translateX(-50%) translateX(${tx.toFixed(1)}px) scaleX(${vis.toFixed(4)})`
            S(R.shadow.current, "transform", sh)
            S(R.shadowC.current, "transform", sh)
            // [Z8] the side under the moving half only while the phone lies flat (the turning half has its own 3D edge)
            S(R.plateL.current, "opacity", flat ? "1" : "0")
            // [Z8] "frosted glass" opening (Flip and Fold): while the phone is half-open the inner screen is
            // blurred and washed out like frosted glass, and comes into focus as it flattens (sharp
            // from ~half-way to flat). Applied to each half's clipped screen area, not the long
            // scrolling content, so the blur only ever covers what is visible.
            {
                const a0 = clamp(k / 0.55, 0, 1) // both Flip and Fold
                const a = a0 * a0 * (3 - 2 * a0) // smoothstep
                const blur = Math.round(a * 6 * 4) / 4 // 0 … 6px (user: softer than the first 14px), 0.25px steps
                const frost =
                    blur > 0
                        ? `blur(${blur}px) brightness(${(1 + 0.04 * a).toFixed(3)}) contrast(${(1 - 0.08 * a).toFixed(3)}) saturate(${(1 + 0.1 * a).toFixed(3)})`
                        : "none"
                S(R.cL.current?.parentElement, "filter", frost)
                S(R.cR.current?.parentElement, "filter", frost)
            }
            if (R.call.current) {
                const on = clamp((p3 - 0.02) * 6, 0, 1)
                S(R.call.current, "opacity", String(+on.toFixed(3)))
                S(R.call.current, "pointerEvents", on > 0.5 ? "auto" : "none")
            }
        }

        // ---- content
        if (L.inner !== inner || kChanged) {
            // moved with `top`, not a transform: a transform inside the turning half would
            // make the browser keep the whole (very tall) content as a separate layer
            const y = (-inner).toFixed(2)
            S(R.cL.current, "top", y + "px")
            S(
                R.cR.current,
                "top",
                (P ? -g.halfH - inner : -inner).toFixed(2) + "px"
            )
            L.inner = inner
        }

        // ---- status bar auto tint: look up the section under it (precomputed, no layout reads)
        if (tintMap.current.length) {
            const y = inner + 14
            let sec = tintMap.current[0]
            for (const s of tintMap.current) {
                if (s.top <= y) sec = s
                else break
            }
            const IL = imgLum.current
            const lum =
                sec.src && IL[sec.src] !== undefined ? IL[sec.src] : sec.lum
            const lumR =
                sec.srcR && IL[sec.srcR] !== undefined ? IL[sec.srcR] : sec.lumR
            // only the status bars change colour (a variable on the root would restyle everything)
            const colL = lum > 0.6 ? "#111" : "#fff"
            const colR = lumR > 0.6 ? "#111" : "#fff"
            const key = colL + colR
            if (L.tint !== key || !L.bars) {
                L.tint = key
                L.bars = rootRef.current
                    ? Array.from(
                          rootRef.current.querySelectorAll("[data-ffsb]")
                      )
                    : []
                L.bars.forEach((el) => {
                    el.style.color = el.dataset.ffsb === "right" ? colR : colL
                    // one bar across an open landscape screen: its right group (5G, battery) follows the right side
                    if (el.dataset.ffsb === "all" && !P) {
                        const r = el.lastElementChild;
                        if (r) r.style.color = colR
                    }
                })
            }
        }
    }

    // ---------- screen scan: status bar tint map, image priming and link hover styles
    const primed = useRef(new WeakSet())
    const scan = useRef(() => {})
    scan.current = () => {
        const roots = [R.cL.current, R.cR.current].filter(Boolean)
        const topOf = (el, root) => {
            let y = 0
            let e = el
            while (e && e !== root) {
                y += e.offsetTop
                e = e.offsetParent
            }
            return y
        }
        const main = R.cR.current || R.cL.current
        // sections of the Screen and how bright they are (for the status bar tint)
        if (main) {
            const lumOf = (el) => {
                while (el && el !== main.parentElement) {
                    const bg = window.getComputedStyle(el).backgroundColor
                    const m = bg.match(/[\d.]+/g)
                    if (m && (m.length < 4 || +m[3] > 0.5))
                        return (
                            (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) /
                            255
                        )
                    el = el.parentElement
                }
                return hexLum(screenColor)
            }
            const slotRoot =
                main.firstElementChild && main.firstElementChild.firstElementChild
            const secs = []
            // the deepest layer under a point near the top-left / top-right corner of a section
            // (a two-column section can be dark on one side and an image on the other)
            const edge = (
                el,
                side
            ) => {
                let cur = el
                const r0 = cur.getBoundingClientRect()
                const px = side === "left" ? r0.left + 24 : r0.right - 24
                const py = r0.top + 18
                for (let d = 0; d < 8; d++) {
                    const kids = Array.from(cur.children);
                    let hit = null
                    for (const k of kids) {
                        if (!k.offsetWidth || !k.offsetHeight) continue
                        const r = k.getBoundingClientRect()
                        if (
                            r.left <= px &&
                            r.right >= px &&
                            r.top <= py &&
                            r.bottom >= py
                        )
                            hit = k
                    }
                    if (!hit) break
                    cur = hit
                    const im =
                        cur.tagName === "IMG" ? cur : null
                    if (im && im.currentSrc) {
                        const src = (im.currentSrc || im.src).split("?")[0]
                        measureLum(src)
                        return { lum: lumOf(cur), src }
                    }
                }
                return { lum: lumOf(cur) }
            }
            if (slotRoot) {
                const e0L = edge(slotRoot, "left"),
                    e0R = edge(slotRoot, "right")
                secs.push({
                    top: 0,
                    lum: e0L.lum,
                    lumR: e0R.lum,
                    src: e0L.src,
                    srcR: e0R.src,
                })
                Array.from(slotRoot.children).forEach((c) => {
                    const el = c;
                    if (!el.offsetHeight) return
                    const eL = edge(el, "left"),
                        eR = edge(el, "right")
                    secs.push({
                        top: topOf(el, main),
                        lum: eL.lum,
                        lumR: eR.lum,
                        src: eL.src,
                        srcR: eR.src,
                    })
                })
            }
            tintMap.current = secs.sort((a, b) => a.top - b.top)
            if (rootRef.current)
                topRef.current =
                    rootRef.current.getBoundingClientRect().top + window.scrollY
        }
        // load + decode every screen image up front: no loading/decoding hitches while scrolling
        roots.forEach((root) =>
            root.querySelectorAll("img").forEach((im) => {
                const img = im;
                if (primed.current.has(img)) return
                primed.current.add(img)
                if (img.loading === "lazy") img.loading = "eager"
                if (img.decode) img.decode().catch(() => {})
            })
        )
        // hover styles for links, detected from their look: pill buttons lift, wide rows slide
        roots.forEach((root) =>
            root.querySelectorAll("a").forEach((el) => {
                if (el.dataset.ffh) return
                const cs = window.getComputedStyle(el)
                const hasBg =
                    cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                    cs.backgroundColor !== "transparent"
                const round = parseFloat(cs.borderTopLeftRadius) >= 12
                const k =
                    hasBg && round && el.offsetWidth < 420
                        ? "b"
                        : el.offsetWidth > root.clientWidth * 0.55
                          ? "r"
                          : ""
                if (k) {
                    el.dataset.ffh = k
                    el.classList.add("ffh-" + k)
                }
            })
        )
        kick.current()
    }
    // how bright the top of an image is (the status bar sits over it)
    const measureLum = (src) => {
        if (imgLum.current[src] !== undefined) return
        imgLum.current[src] = 0.5
        const im = new Image()
        im.crossOrigin = "anonymous"
        im.onload = () => {
            try {
                const c = document.createElement("canvas")
                c.width = 24
                c.height = 24
                const x = c.getContext("2d")
                if (!x) return
                x.drawImage(im, 0, 0, 24, 24)
                const d = x.getImageData(0, 0, 24, 5).data
                let tot = 0
                for (let i = 0; i < d.length; i += 4)
                    tot += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
                imgLum.current[src] = tot / (d.length / 4) / 255
            } catch (e) {}
        }
        im.src = src
    }
    useEffect(() => {
        const a = window.setTimeout(() => scan.current(), 30)
        const b2 = window.setTimeout(() => scan.current(), 700)
        const c = window.setTimeout(() => scan.current(), 2000)
        return () => {
            window.clearTimeout(a)
            window.clearTimeout(b2)
            window.clearTimeout(c)
        }
    }, [contentH, port, vp.w, screenNode])

    // scroll → target, smoothed with a frame-rate independent lerp. The loop sleeps when
    // nothing moves, reads window.scrollY (no forced layout) and wakes up on scroll.
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        let raf = 0
        let running = false
        let cur = -1
        let last = 0
        const measureTop = () => {
            const el = rootRef.current
            if (!el) return
            const r = el.getBoundingClientRect()
            topRef.current = r.top + window.scrollY
            // keep the hinge on a whole screen pixel even when the component itself starts
            // at a fractional x (no blurred seam between the halves)
            if (R.rig.current)
                R.rig.current.style.left =
                    (Math.round(r.left + r.width / 2) - r.left).toFixed(2) +
                    "px"
        }
        measureTop()
        const readTarget = () => Math.max(0, window.scrollY - topRef.current)
        // only animate (idle float) while the device is on screen
        let inView = true
        let io = null
        if (typeof IntersectionObserver !== "undefined" && rootRef.current) {
            io = new IntersectionObserver((es) => {
                inView = es.some((e) => e.isIntersecting)
                if (inView) wake()
            })
            io.observe(rootRef.current)
        }
        const needsTime = () => {
            if (reduce || !inView) return false
            if (fadeIn.current) return true
            return motion.float && live.current.k > 0.0005
        }
        const loop = (t) => {
            const target = readTarget()
            const dt = last ? Math.min(64, t - last) : 16.7
            last = t
            if (cur < 0 || reduce) cur = target
            else {
                const a =
                    1 -
                    Math.pow(1 - clamp(motion.smoothing, 0.02, 1), dt / 16.67)
                cur += (target - cur) * a
            }
            if (Math.abs(target - cur) < 0.1) cur = target
            live.current.cur = cur
            renderFrame.current(cur, t)
            if (fadeIn.current) {
                const p = clamp((t - fadeIn.current) / 420, 0, 1)
                const o = String(+easeOut(p).toFixed(3))
                ;[R.cL.current, R.cR.current].forEach((c) => {
                    if (c) c.style.opacity = o
                })
                if (p >= 1) fadeIn.current = 0
            }
            if (cur !== target || needsTime()) {
                raf = window.requestAnimationFrame(loop)
            } else {
                running = false
                last = 0
            }
        }
        const wake = () => {
            if (document.visibilityState === "hidden") {
                // background tab (no animation frames): just draw the current state
                cur = readTarget()
                live.current.cur = cur
                renderFrame.current(cur, performance.now())
                if (fadeIn.current) {
                    fadeIn.current = 0
                    ;[R.cL.current, R.cR.current].forEach((c) => {
                        if (c) c.style.opacity = "1"
                    })
                }
                return
            }
            if (running) return
            running = true
            raf = window.requestAnimationFrame(loop)
        }
        kick.current = wake
        const onResize = () => {
            measureTop()
            wake()
        }
        // first paint before the loop starts (also covers static renderers)
        cur = readTarget()
        live.current.cur = cur
        renderFrame.current(cur, performance.now())
        wake()
        window.addEventListener("scroll", wake, { passive: true })
        window.addEventListener("resize", onResize)
        document.addEventListener("visibilitychange", wake)
        const iv = window.setTimeout(measureTop, 1200)
        return () => {
            window.cancelAnimationFrame(raf)
            running = false
            if (io) io.disconnect()
            window.clearTimeout(iv)
            window.removeEventListener("scroll", wake)
            window.removeEventListener("resize", onResize)
            document.removeEventListener("visibilitychange", wake)
        }
    }, [motion.smoothing, motion.float])

    // [Z8] in-screen navigation: the open screen's content scrolls with the page, so a link inside it
    // cannot use #anchors. Dispatch `window.dispatchEvent(new CustomEvent("ff:scrollto", { detail: { y } }))`
    // with y = the target's offset from the top of the screen content (screen px); this scrolls the
    // page to the spot where the phone is open and that part of the screen is at the top.
    useEffect(() => {
        const onGo = (e) => {
            const y = Number(e.detail?.y) || 0
            const el = rootRef.current
            const g = geo.current
            if (!el) return
            const top0 = el.getBoundingClientRect().top + window.scrollY
            const inner = clamp(y, 0, g.innerMax)
            const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
            window.scrollTo({ top: top0 + g.U1 + inner * (g.s || 1) + 2, behavior: reduce ? "auto" : "smooth" })
        }
        window.addEventListener("ff:scrollto", onGo)
        return () => window.removeEventListener("ff:scrollto", onGo)
    }, [])

    // [Z8] pointer tilt: the whole device turns a few degrees toward the cursor and the body's
    // side edge (--ff-ex / --ff-ey) follows, so it reads as a solid object, not a flat picture.
    // Mouse/trackpad only; off for reduced motion and on touch screens.
    useEffect(() => {
        const root = rootRef.current
        const wrap = R.wA.current
        if (!root || !wrap) return
        // touch screens have no cursor: rest the phone at a slight fixed angle so its side still shows
        if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            const rx = 0.55,
                ry = -0.35
            wrap.style.transform = `perspective(1800px) rotateX(${(-ry * 4).toFixed(3)}deg) rotateY(${(rx * 6).toFixed(3)}deg)`
            root.style.setProperty("--ff-ex", (-rx * 12).toFixed(2))
            root.style.setProperty("--ff-ey", (EDGE - ry * 9).toFixed(2))
            return () => {
                wrap.style.transform = ""
                root.style.removeProperty("--ff-ex")
                root.style.removeProperty("--ff-ey")
            }
        }
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
        let tx = 0,
            ty = 0,
            x = 0,
            y = 0,
            raf = 0
        const step = () => {
            x += (tx - x) * 0.08
            y += (ty - y) * 0.08
            if (Math.abs(tx - x) < 0.0005 && Math.abs(ty - y) < 0.0005) {
                x = tx
                y = ty
            }
            wrap.style.transform =
                x || y
                    ? `perspective(1800px) rotateX(${(-y * 4).toFixed(3)}deg) rotateY(${(x * 6).toFixed(3)}deg)`
                    : ""
            root.style.setProperty("--ff-ex", (-x * 12).toFixed(2))
            root.style.setProperty("--ff-ey", (EDGE - y * 9).toFixed(2))
            raf = x === tx && y === ty ? 0 : window.requestAnimationFrame(step)
        }
        const kick2 = () => {
            if (!raf) raf = window.requestAnimationFrame(step)
        }
        const onMove = (e) => {
            tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1)
            ty = clamp((e.clientY / window.innerHeight) * 2 - 1, -1, 1)
            kick2()
        }
        const reset = () => {
            tx = 0
            ty = 0
            kick2()
        }
        window.addEventListener("pointermove", onMove, { passive: true })
        document.documentElement.addEventListener("pointerleave", reset)
        window.addEventListener("blur", reset)
        return () => {
            window.cancelAnimationFrame(raf)
            window.removeEventListener("pointermove", onMove)
            document.documentElement.removeEventListener("pointerleave", reset)
            window.removeEventListener("blur", reset)
            wrap.style.transform = ""
        }
    }, [])

    // second page of a visit: the screen content fades in instead of the intro (driven
    // from the loop, so nothing is animated by the compositor)
    const fadeIn = useRef(0)
    // ---------- opening animation: a seam of light, the page parts along the fold, then
    // the phone lifts into place and the colour dots settle.
    // Pure 2D (translate / scale / rotate / opacity) stepped from rAF; everything is
    // reset to the normal state at the end.
    const playIntro = () => {
        const cur = R.iCur.current,
            a = R.iA.current,
            b = R.iB.current,
            seam = R.iSeam.current,
            dev = R.iDev.current
        if (!cur || !a || !b || !seam || !dev) return
        cur.style.animation = "none"
        const sp = 1 / Math.max(0.4, Math.min(2, intro.speed || 1))
        const D = (ms) => ms * sp
        const cl = (v) => Math.min(1, Math.max(0, v))
        const o3 = (k) => 1 - Math.pow(1 - k, 3)
        const o4 = (k) => 1 - Math.pow(1 - k, 4)
        const o5 = (k) => 1 - Math.pow(1 - k, 5)
        const dots = () =>
            R.stage.current
                ? R.stage.current.querySelector("[data-ff-dots]")
                : null
        let done = false
        const early = 280 // no name beside the phone: it comes in a little sooner
        const set = (t) => {
            const k = (x, y) => cl((t - D(x)) / (D(y) - D(x)))
            const P = geo.current.port
            const vh = window.innerHeight,
                vw = window.innerWidth
            const ks = o3(k(0, 560))
            seam.style.transform = P
                ? `scaleX(${ks.toFixed(4)})`
                : `scaleY(${ks.toFixed(4)})`
            seam.style.opacity = String(+(1 - k(760, 1060)).toFixed(3))
            const kc = o4(k(460, 1320))
            const far = (P ? vh : vw) / 2 + 4
            a.style.transform = P
                ? `translateY(${(-kc * far).toFixed(1)}px)`
                : `translateX(${(-kc * far).toFixed(1)}px)`
            b.style.transform = P
                ? `translateY(${(kc * far).toFixed(1)}px)`
                : `translateX(${(kc * far).toFixed(1)}px)`
            const kd = k(820 - early, 2000 - early),
                e = o5(kd)
            dev.style.opacity = String(+cl(kd * 3).toFixed(3))
            dev.style.transform = `translateY(${((1 - e) * vh * 0.5).toFixed(1)}px) rotate(${((1 - e) * -5).toFixed(3)}deg) scale(${(0.82 + 0.18 * e).toFixed(4)})`
            const ku = o3(k(1600, 2250))
            const d = dots()
            if (d) {
                d.style.opacity = String(+ku.toFixed(3))
                d.style.translate = `0 ${((1 - ku) * 14).toFixed(1)}px`
            }
        }
        const end = () => {
            if (done) return
            done = true
            cur.style.display = "none"
            dev.style.transform = ""
            dev.style.opacity = ""
            const d = dots()
            if (d) {
                d.style.opacity = ""
                d.style.translate = ""
            }
            window.removeEventListener("scroll", onScroll)
            document.removeEventListener("visibilitychange", end)
        }
        const onScroll = () => {
            if (window.scrollY > 60) end()
        }
        window.addEventListener("scroll", onScroll, { passive: true })
        document.addEventListener("visibilitychange", end)
        set(0)
        const total = D(2300)
        const t0 = performance.now()
        const step = (now) => {
            if (done) return
            const t = now - t0
            set(t)
            if (t < total) window.requestAnimationFrame(step)
            else end()
        }
        window.requestAnimationFrame(step)
        window.setTimeout(end, total + 1500)
    }
    useLayoutEffect(() => {
        // [Z8] decided once per page load: React StrictMode (dev) runs this effect twice, and the
        // second run used to read its own "ff-seen" flag and cancel the intro
        if (!ffLoad) {
            let s = false
            try {
                s = window.sessionStorage.getItem("ff-seen") === "1"
                window.sessionStorage.setItem("ff-seen", "1")
            } catch (e) {}
            ffLoad = { seen: s, intro: null }
        }
        const seen = ffLoad.seen
        // opening animation: only on the first page of a visit, at the top, in a visible tab
        if (ffLoad.intro === null) {
            const run =
                !intro.off && // the site's own loader reveals the page instead
                !seen &&
                document.visibilityState === "visible" &&
                window.scrollY < 40 &&
                !window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ffLoad.intro = run
            if (run) playIntro()
        }
        if (!ffLoad.intro && R.iCur.current) R.iCur.current.style.display = "none"
        if (seen) {
            // before the first paint: content hidden, then the loop fades it in
            ;[R.cL.current, R.cR.current].forEach((c) => {
                if (c) c.style.opacity = "0"
            })
            fadeIn.current = performance.now()
            kick.current()
        }
    }, [])

    // live clock for the status bar: [Z8] India time, matching the site's IST clock
    const [clock, setClock] = useState("09:41")
    useEffect(() => {
        const tick = () => {
            startTransition(() => setClock(indiaHHMM()))
        }
        tick()
        const id = window.setInterval(tick, 15000)
        return () => window.clearInterval(id)
    }, [])

    // ---------------------------------------------------------------- styles
    const T = G.T
    const Ri = G.R - b
    // [Z8] the metal frame: anodised aluminium with two specular bands, a crisp outer line, and a
    // diamond-cut chamfer (a bright ring just inside the edge, then a faint dark one)
    const slabBg = `linear-gradient(145deg, ${F[2]} 0%, ${F[0]} 16%, ${F[1]} 38%, ${F[0]} 54%, ${F[2]} 62%, ${F[0]} 70%, ${F[1]} 86%, ${F[3]} 100%)`
    const slabShadow =
        "0 0 0 .5px rgba(0,0,0,.32), inset 0 1px 1px rgba(255,255,255,.85), inset 0 -1px 1px rgba(0,0,0,.32), inset 0 0 0 1px rgba(255,255,255,.3), inset 0 0 0 2px rgba(0,0,0,.07)"
    const abs = { position: "absolute" }
    const fill = { position: "absolute", inset: 0 }

    // [Z8] real body thickness: a strip on the outer edge of a turning half, folded back 90deg in 3D,
    // so the phone's metal side is visible while it opens and closes
    const edgeBg = `linear-gradient(${land ? "90deg" : "180deg"}, ${F[3]}, ${F[1]} 28%, ${F[2]} 52%, ${F[1]} 78%, ${F[3]})`
    const edgeStrip = (which) => {
        const inset = Ro * 0.55
        const base = {
            ...abs,
            background: edgeBg,
            borderRadius: T / 2,
            pointerEvents: "none",
        }
        // antenna bands across the metal side, a quarter of the way in from each end
        const bands = (vertical) =>
            [0.2, 0.8].map((at) => (
                <div
                    key={at}
                    style={{
                        ...abs,
                        ...(vertical ? { left: 0, right: 0, top: `${at * 100}%`, height: 2.5 } : { top: 0, bottom: 0, left: `${at * 100}%`, width: 2.5 }),
                        background: mixHex(F[1], F[3], 0.55),
                        opacity: 0.75,
                    }}
                />
            ))
        if (land)
            return which === "leaf" ? (
                <div aria-hidden style={{ ...base, left: 0, top: inset, bottom: inset, width: T, transformOrigin: "0% 50%", transform: "rotateY(90deg)" }}>{bands(true)}</div>
            ) : (
                <div aria-hidden style={{ ...base, right: 0, top: inset, bottom: inset, width: T, transformOrigin: "100% 50%", transform: "rotateY(-90deg)" }}>{bands(true)}</div>
            )
        // Flip: the strip starts in the frame colour where it joins the body and darkens toward the
        // back, so it reads as one piece of metal (a dark joint made it look like a separate rod)
        const pIn = Ro * 0.3
        const pBg = (dir) => `linear-gradient(${dir}, ${F[1]}, ${F[1]} 18%, ${F[2]} 55%, ${F[3]})`
        return which === "leaf" ? (
            <div aria-hidden data-ffedge="" style={{ ...base, background: pBg("180deg"), borderRadius: `0 0 ${T / 2}px ${T / 2}px`, top: 0, left: pIn, right: pIn, height: T, transformOrigin: "50% 0%", transform: "rotateX(-90deg)" }}>{bands(false)}</div>
        ) : (
            <div aria-hidden data-ffedge="" style={{ ...base, background: pBg("0deg"), borderRadius: `${T / 2}px ${T / 2}px 0 0`, bottom: 0, left: pIn, right: pIn, height: T, transformOrigin: "50% 100%", transform: "rotateX(90deg)" }}>{bands(false)}</div>
        )
    }

    // [Z8] cameras. Fold 8: punch-hole on the cover, faint under-display camera on the inner screen.
    // Flip 8: two large lens rings on the FlexWindow (cover), punch-hole on the inner screen.
    const holeStyle = (d, top, faint = false) => ({
        ...abs,
        top,
        left: "50%",
        width: d,
        height: d,
        marginLeft: -d / 2,
        borderRadius: "50%",
        zIndex: 7,
        pointerEvents: "none",
        background: faint
            ? "radial-gradient(circle, rgba(0,0,0,.22), rgba(0,0,0,.1) 58%, rgba(0,0,0,0) 72%)"
            : "radial-gradient(circle at 38% 34%, #2b2c35 0%, #0b0b10 45%, #000 70%)",
        boxShadow: faint ? "none" : "0 0 0 1.5px rgba(0,0,0,.6), inset 0 0 3px rgba(120,130,170,.55)",
    })
    const innerCam = (kind) => (
        <div aria-hidden style={kind === "udc" ? holeStyle(26, 26, true) : holeStyle(20, 14)} />
    )
    // Flip: no cameras (removed at the user's request)
    const coverCams = land ? <div aria-hidden style={holeStyle(24, 24)} /> : null
    // status bar: white to start with; the loop picks dark or light from the screen under it
    const statusBar = (part) => (
            <div
                data-ffsb={part}
                style={{
                    ...abs,
                    left: 0,
                    right: 0,
                    top: 0,
                    height: port ? 36 : 40,
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                        part === "right" ? "flex-end" : "space-between",
                    padding: port ? "0 22px" : "0 26px",
                    font: "600 13px/1 var(--font)" /* [Z8] site font (was Inter, system-ui) */,
                    color: "#fff",
                    letterSpacing: "-.01em",
                    textShadow: "none",
                    pointerEvents: "none",
                    zIndex: 6,
                }}
            >
                {part !== "right" && <span>{clock}</span>}
                {part !== "left" && (
                    <span
                        style={{
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            fontSize: 12,
                        }}
                    >
                        <span>5G</span>
                        <svg
                            width="25"
                            height="12"
                            viewBox="0 0 25 12"
                            style={{ display: "block", opacity: 0.95 }}
                            aria-hidden="true"
                        >
                            <rect
                                x="0.75"
                                y="0.75"
                                width="21.5"
                                height="10.5"
                                rx="3.25"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                            />
                            <rect
                                x="2.75"
                                y="2.75"
                                width="13.5"
                                height="6.5"
                                rx="1.5"
                                fill="currentColor"
                            />
                            <rect
                                x="23.25"
                                y="4.25"
                                width="1.5"
                                height="3.5"
                                rx="0.75"
                                fill="currentColor"
                                opacity="0.55"
                            />
                        </svg>
                    </span>
                )}
            </div>
        )

    // Realistic crease: soft depression + highlight, blends with anything underneath.
    const crease = (side) => {
        // barely-there, like a real foldable in daylight: a soft dip with a faint sheen
        // a wide, very soft dip only (no line, no highlight): you sense the fold, you don't see a seam
        const w = 72
        const grad = (dir) =>
            `linear-gradient(${dir}, rgba(0,0,0,0) 0%, rgba(0,0,0,.008) 35%, rgba(0,0,0,.016) 50%, rgba(0,0,0,.008) 65%, rgba(0,0,0,0) 100%)`
        const base = {
            ...abs,
            pointerEvents: "none",
            zIndex: 7,
        }
        if (!port) {
            const left =
                side === "left"
                    ? `calc(100% - ${w / 2}px)`
                    : side === "right"
                      ? `${-w / 2}px`
                      : `calc(50% - ${w / 2}px)`
            return (
                <div
                    data-crease="1"
                    style={{
                        ...base,
                        top: 0,
                        bottom: 0,
                        width: w,
                        left,
                        background: grad("90deg"),
                    }}
                />
            )
        }
        const top =
            side === "top"
                ? `calc(100% - ${w / 2}px)`
                : side === "bottom"
                  ? `${-w / 2}px`
                  : `calc(50% - ${w / 2}px)`
        return (
            <div
                style={{
                    ...base,
                    left: 0,
                    right: 0,
                    height: w,
                    top,
                    background: grad("180deg"),
                }}
            />
        )
    }
    // one sheen across the whole display: each half shows its part of a device-wide gradient
    const sheen = (part) => (
        <div
            style={{
                ...fill,
                pointerEvents: "none",
                zIndex: 8,
                background:
                    "linear-gradient(118deg, rgba(255,255,255,.08) 0%, rgba(255,255,255,.025) 22%, rgba(255,255,255,0) 38%)",
                backgroundSize: part
                    ? port
                        ? "100% 200%"
                        : "200% 100%"
                    : "100% 100%",
                backgroundPosition:
                    part === "R" ? (port ? "50% 100%" : "100% 50%") : "0 0",
            }}
        />
    )

    // Screen content copies: one per half ("L" turns with the leaf, "R" is measured)
    const contentCopy = (which) => {
        const ref = which === "L" ? R.cL : R.cR
        const offX = !port && which === "R" ? -halfW : 0
        const offY = port && which === "R" ? -halfH : 0
        return (
            <div
                ref={ref}
                aria-hidden={which === "L" ? true : undefined}
                style={{
                    ...abs,
                    left: offX,
                    top: offY,
                    width: Ws,
                }}
            >
                <div
                    ref={which === "R" ? measureRef : undefined}
                    style={{ width: Ws }}
                >
                    <Slot node={screenNode} width={Ws} />
                </div>
            </div>
        )
    }

    // ---------------------------------------------------------------- device (v7: flat pieces)
    // The phone is made of three flat pieces: the right half (never moves), the left half
    // (turns over the hinge while it opens) and the cover (the back of the left half, seen
    // when the phone is closed). Each piece is a single element with its own simple
    // perspective turn — no nested 3D scene — and when the phone is open everything is plain
    // 2D. That keeps every browser/GPU drawing the whole screen reliably.
    const leafBox = land
        ? {
              ...abs,
              left: 0,
              top: 0,
              width: G.W / 2,
              height: G.H,
              transformOrigin: "100% 50%",
          }
        : {
              ...abs,
              left: 0,
              top: 0,
              width: G.W,
              height: G.H / 2,
              transformOrigin: "50% 100%",
          }
    const rightBox = land
        ? {
              ...abs,
              left: G.W / 2,
              top: 0,
              width: G.W / 2,
              height: G.H,
              transformOrigin: "0% 50%",
          }
        : {
              ...abs,
              left: 0,
              top: G.H / 2,
              width: G.W,
              height: G.H / 2,
              transformOrigin: "50% 0%",
          }
    // insets for glass / screen; the hinge side has none so the two screens meet
    const insets = (v, hinge) => ({
        top: hinge === "T" ? 0 : v,
        bottom: hinge === "B" ? 0 : v,
        left: hinge === "L" ? 0 : v,
        right: hinge === "R" ? 0 : v,
    })
    const hingeOfLeaf = land ? "R" : "B"
    const hingeOfRight = land ? "L" : "T"
    const cornerT = "border-radius .35s cubic-bezier(.2,.7,.2,1)"
    // [Z8] antenna bands: short plastic breaks across the metal rim, two per outer edge (none on the
    // hinge side). Drawn under the glass, so only the rim's width of each shows.
    const rimBands = (hinge) => {
        const bar = mixHex(F[1], F[3], 0.5)
        const out = []
        const along = (edge) => {
            if (edge === "T" || edge === "B") {
                // horizontal edge: Fold halves are narrow (one pair near the outer corner), Flip is one wide edge
                if (land) return [hinge === "L" ? 0.8 : 0.2]
                return [0.2, 0.8]
            }
            if (land) return [0.11, 0.89]
            return [hinge === "T" ? 0.72 : 0.28]
        }
        for (const edge of ["T", "B", "L", "R"]) {
            if (edge === hinge) continue
            for (const at of along(edge)) {
                const horiz = edge === "T" || edge === "B"
                out.push(
                    <div
                        key={edge + at}
                        aria-hidden
                        style={{
                            ...abs,
                            [edge === "T" ? "top" : edge === "B" ? "bottom" : edge === "L" ? "left" : "right"]: 0,
                            ...(horiz ? { left: `${at * 100}%`, width: 2.5, height: G.f + 1 } : { top: `${at * 100}%`, height: 2.5, width: G.f + 1 }),
                            background: bar,
                            opacity: 0.6,
                            pointerEvents: "none",
                        }}
                    />
                )
            }
        }
        return out
    }
    // [Z8] the screen glass meets the frame in a soft 2.5D bevel: a faint bright lip and a dark line
    const glassBevel = (corners, hinge) => (
        <div
            aria-hidden
            style={{
                ...abs,
                ...insets(G.f, hinge),
                borderRadius: inner(corners, G.f),
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.16), inset 0 0 0 1px rgba(255,255,255,.06), inset 0 -1px 0 rgba(0,0,0,.5)",
                pointerEvents: "none",
            }}
        />
    )
    const body = (corners, hinge, children, refs, extra) => (
        <>
            <div
                ref={refs && refs[0]}
                style={{
                    ...abs,
                    ...insets(0, hinge),
                    borderRadius: corners,
                    background: slabBg,
                    boxShadow: slabShadow,
                    transition: refs ? cornerT : undefined,
                }}
            />
            {rimBands(hinge)}
            <div
                ref={refs && refs[1]}
                style={{
                    ...abs,
                    ...insets(G.f, hinge),
                    borderRadius: inner(corners, G.f),
                    background: "#050505",
                    transition: refs ? cornerT : undefined,
                }}
            />
            {glassBevel(corners, hinge)}
            <div
                ref={refs && refs[2]}
                style={{
                    ...abs,
                    ...insets(b, hinge),
                    borderRadius: inner(corners, b),
                    background: screenColor,
                    overflow: "hidden",
                    contain: "paint",
                    transition: refs ? cornerT : undefined,
                }}
            >
                {children}
            </div>
            {extra}
        </>
    )
    const shadeGrad = (dir) => {
        const d = land ? "90deg" : "180deg"
        if (dir === "front")
            return `linear-gradient(${d}, rgba(0,0,0,.05) 0%, rgba(0,0,0,.55) 100%)`
        if (dir === "back")
            return `linear-gradient(${d}, rgba(0,0,0,.5) 0%, rgba(0,0,0,.05) 100%)`
        return `linear-gradient(${d}, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 70%)`
    }
    // Side keys on the outer frame: a volume rocker (two-way, with its centre seam) above the power
    // key, which doubles as the fingerprint reader (a flat, slightly darker pad set into it).
    // [Z8] rounded metal: lit on its outer face, shaded where it leaves the frame, a drop shadow on the rim.
    const keyBg = `linear-gradient(90deg, ${F[3]} 0%, ${F[1]} 22%, ${F[2]} 52%, ${F[0]} 70%, ${F[1]} 88%, ${F[3]})`
    const sideButtons = (
        <>
            {[
                [0.17, 0.1, "volume"],
                [0.31, 0.06, "power"],
            ].map(([top, h, kind]) => (
                <div
                    key={kind}
                    aria-hidden
                    style={{
                        ...abs,
                        right: -3.5,
                        width: 5.5,
                        borderRadius: 3,
                        top: land
                            ? `${top * 100}%`
                            : `${(top * 0.8 + 0.05) * 100}%`,
                        height: `${h * (land ? 100 : 160)}%`,
                        background: keyBg,
                        boxShadow: "0 0 0 .5px rgba(0,0,0,.28), 1px 0 1.5px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.45), inset 0 -1px 0 rgba(0,0,0,.18)",
                        pointerEvents: "none",
                    }}
                >
                    {kind === "volume" ? (
                        // the rocker's centre seam
                        <div style={{ ...abs, left: 1, right: 0, top: "50%", height: 1, marginTop: -0.5, background: "rgba(0,0,0,.28)", boxShadow: "0 1px 0 rgba(255,255,255,.25)" }} />
                    ) : (
                        // fingerprint pad: flush, matte, a touch darker than the metal around it
                        <div style={{ ...abs, left: 1.5, right: 0.5, top: 4, bottom: 4, borderRadius: 2, background: `linear-gradient(90deg, ${mixHex(F[1], F[3], 0.6)}, ${F[1]})`, opacity: 0.85 }} />
                    )}
                </div>
            ))}
        </>
    )
    // [Z8] a sharp glare across the glass that slides as the phone tilts towards the cursor (the
    // tilt's own --ff-ex / --ff-ey), so the screen reads as glass rather than a picture.
    // One gradient across the whole device: each half shows its own part of it.
    const glare = (part) => {
        const g =
            "linear-gradient(112deg, rgba(255,255,255,0) 40%, rgba(255,255,255,.035) 46%, rgba(255,255,255,.075) 50%, rgba(255,255,255,.035) 54%, rgba(255,255,255,0) 60%)"
        const size = !part ? "100% 100%" : port ? `100% ${G.H}px` : `${G.W}px 100%`
        const off = part === "R" ? -(port ? G.H : G.W) / 2 : 0 // this half's slot in the device
        return (
            <div
                aria-hidden
                style={{
                    ...fill,
                    pointerEvents: "none",
                    zIndex: 8,
                    backgroundImage: g,
                    backgroundRepeat: "no-repeat",
                    backgroundSize: size,
                    backgroundPosition: port
                        ? `0 calc(${off}px + (var(--ff-ey, ${EDGE}) - ${EDGE}) * 9px)`
                        : `calc(${off}px + var(--ff-ex, 0) * 9px) 0`,
                }}
            />
        )
    }
    // [Z8] the hinge: where the two halves meet, its rounded end caps stand just proud of the frame at
    // both ends of the fold. Placed on the right half's hinge edge (half over each half), so they're
    // hidden with it when the phone is closed and drawn under the cover while it folds.
    const hingeCaps = [0, 1].map((end) => {
        const len = 22
        const thick = G.f + 3
        const pos = land
            ? { left: -len / 2, width: len, height: thick, [end ? "bottom" : "top"]: -1.5 }
            : { top: -len / 2, height: len, width: thick, [end ? "right" : "left"]: -1.5 }
        return (
            <div
                key={end}
                aria-hidden
                style={{
                    ...abs,
                    ...pos,
                    borderRadius: 3,
                    background: `linear-gradient(${land ? "90deg" : "180deg"}, ${F[3]}, ${F[1]} 26%, ${F[2]} 50%, ${F[1]} 74%, ${F[3]})`,
                    boxShadow: "0 0 0 .5px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.35)",
                    pointerEvents: "none",
                    zIndex: 11,
                }}
            >
                {/* the seam between the halves, running through the cap */}
                <div style={{ ...abs, ...(land ? { left: "50%", top: 0, bottom: 0, width: 1, marginLeft: -0.5 } : { top: "50%", left: 0, right: 0, height: 1, marginTop: -0.5 }), background: "rgba(0,0,0,.35)" }} />
            </div>
        )
    })

    // [Z8] the phone's body seen from the side: two plates hidden right behind the halves. Their stacked
    // shadows form a solid metal edge under (and, with the tilt, beside) the device.
    // [Z8] the first layer is a bright chamfer where the side meets the front; the side then darkens
    // towards the back, like a rounded metal band catching the light from above
    const sideShadow =
        Array.from({ length: 7 }, (_, i) => {
            const fr = ((i + 1) / 7).toFixed(3)
            const c = i === 0 ? mixHex(F[2], F[1], 0.35) : i === 1 ? F[0] : mixHex(F[1], F[3], (i + 1) / 7)
            return `calc(var(--ff-ex, 0) * ${fr}px) calc(var(--ff-ey, ${EDGE}) * ${fr}px) 0 0 ${c}`
        }).join(", ") + `, calc(var(--ff-ex, 0) * 1px) calc(var(--ff-ey, ${EDGE}) * 1px + 1.5px) 1px 0 rgba(0,0,0,.22)`
    // [Z8] details on the bottom side of a half: they sit half-way down the side band (so they move
    // with the tilt like the side itself) and fade out when the tilt leaves no side to put them on.
    // The plate is behind the halves, so nothing here can show over the front.
    const onSide = (x, w, h, style, key) => (
        <div
            key={key}
            aria-hidden
            style={{
                ...abs,
                left: x,
                top: "100%",
                width: w,
                height: h,
                marginLeft: -w / 2,
                marginTop: -h / 2,
                transform: `translate(calc(var(--ff-ex, 0) * .5px), calc(var(--ff-ey, ${EDGE}) * .55px))`,
                opacity: `clamp(0, calc((var(--ff-ey, ${EDGE}) - 3) * .45), 1)`,
                pointerEvents: "none",
                ...style,
            }}
        />
    )
    const speaker = (x, n, key) =>
        onSide(x, n * 4.6, 2.6, { background: "radial-gradient(circle, #0d0d0e 0 1.05px, rgba(13,13,14,0) 1.45px) 0 50% / 4.6px 100% repeat-x" }, key)
    const usbC = (x) =>
        onSide(x, 30, 3.4, { borderRadius: 2, background: "linear-gradient(#050506, #1a1a1d)", boxShadow: `0 0 0 .7px ${mixHex(F[1], F[3], 0.7)}, inset 0 .5px .5px rgba(255,255,255,.14)` }, "usb")
    const mic = (x, key) => onSide(x, 2.2, 2.2, { borderRadius: "50%", background: "#0d0d0e" }, key)
    // main half: USB-C in the middle, the loudspeaker to one side, a microphone to the other.
    // The other half has its second speaker (stereo). The Flip's other half has its hinge below.
    const sideDetailsR = [usbC("50%"), speaker("76%", 6, "spk"), mic("24%", "mic")]
    const sideDetailsL = land ? [speaker("30%", 6, "spk2"), mic("70%", "mic2")] : null
    const bodySide = (
        <>
            <div ref={R.plateL} aria-hidden style={{ ...leafBox, borderRadius: cLeaf, background: F[1], boxShadow: sideShadow, transition: "opacity .25s ease", pointerEvents: "none" }}>
                {sideDetailsL}
            </div>
            <div ref={R.plateR} aria-hidden style={{ ...rightBox, borderRadius: cRight, background: F[1], boxShadow: sideShadow, pointerEvents: "none" }}>
                {sideDetailsR}
            </div>
        </>
    )

    const floorShadows = (
        <>
            <div
                ref={R.shadow}
                style={{
                    ...abs,
                    left: "50%",
                    top: "100%",
                    marginTop: G.H * 0.045,
                    height: G.H * 0.09,
                    borderRadius: "50%",
                    background:
                        "radial-gradient(closest-side, rgba(0,0,0,.16), rgba(0,0,0,.06) 50%, rgba(0,0,0,0))",
                    width: G.W * 1.05,
                    transform: "translateX(-50%)",
                    transformOrigin: "50% 50%",
                    pointerEvents: "none",
                }}
            />
            <div
                ref={R.shadowC}
                style={{
                    ...abs,
                    left: "50%",
                    top: "100%",
                    marginTop: G.H * 0.012,
                    height: G.H * 0.03,
                    borderRadius: "50%",
                    background:
                        "radial-gradient(closest-side, rgba(0,0,0,.22), rgba(0,0,0,.07) 55%, rgba(0,0,0,0))",
                    width: G.W * 0.86,
                    transform: "translateX(-50%)",
                    transformOrigin: "50% 50%",
                    pointerEvents: "none",
                }}
            />
        </>
    )

    const coverInner = (
        <>
            {coverNode && (
                <div
                    style={{ ...fill, cursor: "pointer" }}
                    onClick={(e) => {
                        // tap the closed phone to unfold it
                        const tg = e.target;
                        if (
                            tg &&
                            tg.closest &&
                            tg.closest("a,button,input,select,textarea")
                        )
                            return
                        const el = rootRef.current
                        if (!el || live.current.k < 0.9) return
                        const top0 =
                            el.getBoundingClientRect().top + window.scrollY
                        window.scrollTo({
                            top: top0 + geo.current.U1 + 2,
                            behavior: "smooth",
                        })
                    }}
                >
                    <Slot
                        node={coverNode}
                        width="100%"
                        style={{ height: "100%" }}
                    />
                </div>
            )}
            {callNode && (
                <div
                    ref={R.call}
                    style={{
                        ...fill,
                        opacity: 0,
                        zIndex: 4,
                    }}
                >
                    <Slot
                        node={callNode}
                        width="100%"
                        style={{ height: "100%" }}
                    />
                </div>
            )}
            {sheen()}
            {glare()}
        </>
    )

    const device = (
        <div
            ref={R.dev}
            style={{
                ...abs,
                left: -G.W / 2,
                top: -G.H / 2,
                width: G.W,
                height: G.H,
                // this box is the size of the unfolded phone (and shifts sideways while closed):
                // only the phone's own pieces below take clicks, so the empty part never blocks the
                // desk mat (e.g. the iPod lying next to the closed phone)
                pointerEvents: "none",
            }}
        >
            {floorShadows}
            {bodySide /* [Z8] */}
            {/* right / bottom half: never moves */}
            {/* [Z8] isolate: keeps this half's z-index 9 shading inside it, so it can't paint over the cover's edge strip */}
            <div ref={R.rightH} style={{ ...rightBox, isolation: "isolate", pointerEvents: "auto" }}>
                {body(
                    cRight,
                    hingeOfRight,
                    <>
                        {contentCopy("R")}
                        {land && statusBar("right")}
                        {land && innerCam("udc") /* [Z8] Fold 8 under-display camera */}
                        {crease(land ? "right" : "bottom")}
                        {sheen("R")}
                        {glare("R")}
                    </>,
                    [R.rBody, R.rGlass, R.rScreen],
                    <>
                        {sideButtons}
                        {/* [Z8] at this half's hinge edge; shown by the loop only while the left half faces us */}
                        <div ref={R.caps} style={{ visibility: "hidden" }}>{hingeCaps}</div>
                        <div
                            ref={R.shR}
                            style={{
                                ...fill,
                                borderRadius: cRight,
                                background: shadeGrad("right"),
                                opacity: 0,
                                pointerEvents: "none",
                                zIndex: 9,
                                transition: cornerT,
                            }}
                        />
                    </>
                )}
            </div>
            {/* left / top half: turns over the hinge */}
            <div ref={R.leaf} style={{ ...leafBox, transformStyle: "preserve-3d" /* [Z8] */, pointerEvents: "auto" }}>
                {edgeStrip("leaf") /* [Z8] */}
                {body(
                    cLeaf,
                    hingeOfLeaf,
                    <>
                        {contentCopy("L")}
                        {statusBar(land ? "left" : "all")}
                        {crease(land ? "left" : "top")}
                        {sheen("L")}
                        {glare("L")}
                    </>,
                    undefined,
                    <div
                        ref={R.shF}
                        style={{
                            ...fill,
                            borderRadius: cLeaf,
                            background: shadeGrad("front"),
                            opacity: 0,
                            pointerEvents: "none",
                            zIndex: 9,
                        }}
                    />
                )}
            </div>
            {/* cover: the outside of the left half, lies on the right half when closed */}
            <div
                ref={R.cover}
                style={{ ...rightBox, visibility: "hidden", transformStyle: "preserve-3d" /* [Z8] */, pointerEvents: "auto" }}
            >
                {edgeStrip("cover") /* [Z8] */}
                <div
                    style={{
                        ...fill,
                        borderRadius: cAll,
                        background: slabBg,
                        boxShadow: slabShadow,
                    }}
                />
                {rimBands(hingeOfRight)}
                <div
                    style={{
                        ...abs,
                        inset: G.f,
                        borderRadius: Ro - G.f,
                        background: "#050505",
                    }}
                />
                {glassBevel(cAll, null)}
                {/* [Z8] Fold cover: the earpiece, a fine slit in the glass border above the camera */}
                {land && (
                    <div
                        aria-hidden
                        style={{
                            ...abs,
                            top: G.f + (G.bz - 2) / 2,
                            left: "50%",
                            width: 58,
                            marginLeft: -29,
                            height: 2,
                            borderRadius: 1,
                            background: "#1b1b1e",
                            boxShadow: "inset 0 .5px 0 rgba(255,255,255,.1), 0 .5px 0 rgba(255,255,255,.05)",
                            pointerEvents: "none",
                            zIndex: 1,
                        }}
                    />
                )}
                <div
                    style={{
                        ...abs,
                        inset: b,
                        borderRadius: Ro - b,
                        background: screenColor,
                        overflow: "hidden",
                        contain: "paint",
                    }}
                >
                    {coverInner}
                    {coverCams /* [Z8] */}
                </div>
                {sideButtons}
                <div
                    ref={R.shB}
                    style={{
                        ...fill,
                        borderRadius: cAll,
                        background: shadeGrad("back"),
                        opacity: 0,
                        pointerEvents: "none",
                        zIndex: 9,
                    }}
                />
            </div>

            {/* nav on top of the open display */}
            <div
                ref={R.overlay}
                style={{
                    ...abs,
                    left: b,
                    top: b,
                    width: Ws,
                    height: Hs,
                    borderRadius: Ri,
                    overflow: "hidden",
                    pointerEvents: "none",
                    opacity: 0,
                    zIndex: 10,
                }}
            >
                {navNode && (
                    <div
                        style={{
                            ...abs,
                            left: 0,
                            right: 0,
                            bottom: port ? 16 : 20,
                            display: "flex",
                            justifyContent: "center",
                            pointerEvents: "auto",
                        }}
                    >
                        <Slot node={navNode} />
                    </div>
                )}
            </div>
        </div>
    )

    // ---------------------------------------------------------------- background
    // Basic: one soft tint of the frame colour that follows the finish; the intro curtain matches it
    const tintBg = mixHex(F[0], "#FFFFFF", 0.8)
    const curtainBg = intro.color || tintBg

    // ---------------------------------------------------------------- finish switcher
    const compact = vp.w < 560
    const switcherUI = (
        <div
            data-ff-dots=""
            style={{
                // [Z8] pinned to the screen's real bottom edge, like the cat's switch beside it: the stage
                // keeps its first height on phones (see vp), so stage-bottom drifted above it once the
                // address bar slid away
                position: "fixed",
                left: compact ? switcher.right : "50%",
                bottom: switcher.bottom,
                transform: compact ? "none" : "translateX(-50%)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                zIndex: 20,
                pointerEvents: "auto",
                font: "500 12px/1 var(--font)" /* [Z8] site font (was Inter, system-ui) */,
                color: "#111",
            }}
        >
            <div
                role="radiogroup"
                aria-label="Finish"
                style={{
                    display: "flex",
                    borderRadius: 999,
                    background: "rgba(255,255,255,.92)",
                    boxShadow:
                        "inset 0 0 0 1px rgba(0,0,0,.06), 0 10px 30px -12px rgba(0,0,0,.25)",
                    gap: 8,
                    padding: "8px 10px",
                }}
            >
                {FINISH_KEYS.map((fk) => (
                    <button
                        key={fk}
                        role="radio"
                        aria-checked={finish === fk}
                        aria-label={FINISHES[fk].label}
                        title={FINISHES[fk].label}
                        onClick={() => choose(fk)}
                        style={{
                            all: "unset",
                            cursor: "pointer",
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${FINISHES[fk].c[2]}, ${FINISHES[fk].c[1]})`,
                            boxShadow:
                                finish === fk
                                    ? "0 0 0 2px #fff, 0 0 0 3.5px #111"
                                    : "inset 0 0 0 1px rgba(0,0,0,.15)",
                            transition: "box-shadow .3s",
                        }}
                    />
                ))}
            </div>
        </div>
    )

    // ---------------------------------------------------------------- render
    return (
        <div
            ref={rootRef}
            className="ffm-hover ffm-lite"
            style={{
                ...props.style,
                position: "relative",
                width: "100%",
                height: totalH,
            }}
        >
            <style>{PAGE_CSS}</style>
            <div
                ref={R.stage}
                style={{
                    position: "sticky",
                    top: 0,
                    width: "100%",
                    height: stageH,
                    overflow: "hidden",
                    background: pageBg || undefined,
                }}
            >
                {/* [Z8] the layer behind the phone is pinned to the screen and as tall as the screen gets
                    once a phone's address bar slides away (100lvh): the stage itself keeps its first
                    height (so the layout doesn't jump), which used to leave a strip at the bottom where
                    the page scrolled by underneath. Fixed escapes the stage's overflow clip. */}
                <div className="ff-backdrop" style={{ position: "fixed", left: 0, top: 0, width: "100%", height: "100vh" }}>
                    <div style={{ ...fill, pointerEvents: "none", background: tintBg }} />
                    {props.backdrop /* [BG] your own layer behind the phone (above the Basic tint) */}
                </div>
                <div
                    ref={R.rig}
                    style={{
                        ...abs,
                        left: cx,
                        top: cy,
                        width: 0,
                        height: 0,
                        zIndex: 3,
                    }}
                >
                    <div ref={R.iDev} style={{ ...abs, left: 0, top: 0 }}>
                        <div
                            ref={R.wA}
                            style={{
                                ...abs,
                                left: 0,
                                top: 0,
                            }}
                        >
                            <div
                                style={{
                                    ...abs,
                                    left: 0,
                                    top: 0,
                                    transform: `scale(${s})`,
                                }}
                            >
                                {device}
                            </div>
                        </div>
                    </div>
                </div>
                {switcherUI}
                <div
                    ref={R.iCur}
                    data-ff-intro=""
                    aria-hidden="true"
                    style={{
                        ...fill,
                        zIndex: 25,
                        pointerEvents: "none",
                        animation: "ffi-safe .4s 4s forwards",
                    }}
                >
                    <style>{`@keyframes ffi-safe{to{opacity:0;visibility:hidden}}`}</style>
                    <div
                        ref={R.iA}
                        style={{
                            ...abs,
                            background: curtainBg,
                            ...(port
                                ? {
                                      left: 0,
                                      right: 0,
                                      top: 0,
                                      height: cy + 1,
                                  }
                                : {
                                      top: 0,
                                      bottom: 0,
                                      left: 0,
                                      width: cx + 1,
                                  }),
                        }}
                    />
                    <div
                        ref={R.iB}
                        style={{
                            ...abs,
                            background: curtainBg,
                            ...(port
                                ? { left: 0, right: 0, top: cy, bottom: 0 }
                                : {
                                      top: 0,
                                      bottom: 0,
                                      left: cx,
                                      right: 0,
                                  }),
                        }}
                    />
                    <div
                        ref={R.iSeam}
                        data-ff-seam="" /* [Z8] the site loader lines its progress line up with this */
                        style={{
                            ...abs,
                            background: intro.line,
                            ...(port
                                ? {
                                      left: 0,
                                      right: 0,
                                      top: cy - 0.5,
                                      height: 1,
                                      transform: "scaleX(0)",
                                  }
                                : {
                                      top: 0,
                                      bottom: 0,
                                      left: cx - 0.5,
                                      width: 1,
                                      transform: "scaleY(0)",
                                  }),
                        }}
                    />
                </div>
            </div>
        </div>
    )
}
