// @ts-nocheck -- vendor file: the Foldfolio Framer template's FoldfolioDevice.tsx, excluded from type-check and lint.
// Modified only where marked [Z8] (Galaxy Z Fold 8 / Z Flip 8 shapes, cameras, real 3D thickness, pointer tilt).
// The untouched original is in _archive/foldfolio-original/. Configure it through Foldfolio.tsx.
// Foldfolio Device — the foldable phone that holds the whole site.
//
// Brief (Noor): the device is the key feature and must look very realistic.
// Duo-style opening, no camera, rounded corners on the hinge side when closed,
// a realistic crease instead of a flat line, no "squeezed" leaf while opening,
// fits every screen size, 4 frame finishes and 3 backgrounds (Basic / Glow / Orbit)
// with an optional live switcher. Everything inside the screens stays native Framer:
// connect your own frames (with CMS lists, links, effects) to the slots.
//
// How it works
// - Mode "Fold (Home)": scroll opens the device, scrolls the Screen content, folds it
//   shut and shows the Call screen on the cover.
// - Mode "Open (pages)": the device rises in already open; page scroll moves the
//   Screen content inside the display.
// - Landscape (book fold) on wide screens, Portrait (flip fold) on phones & tall screens.
//   Design your Screen frames at 976 px (landscape) and 358 px (portrait) wide.

import { indiaHHMM } from "../site/indiaTime" // [Z8]
import * as React from "react"
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    startTransition,
} from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import { createPortal } from "react-dom"

const useIsoLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect

// ---------------------------------------------------------------- constants

type Mode = "fold" | "open"
type Scene = "split" | "glow" | "orbit" | "none"
type Finish = "titanium" | "graphite" | "coral" | "sage" | "custom"
type Orientation = "auto" | "landscape" | "portrait"

// Four hand-tuned finishes: [base, shade, highlight, deep]
const FINISHES: Record<
    Exclude<Finish, "custom">,
    { label: string; c: string[] }
> = {
    titanium: {
        label: "Titanium",
        c: ["#DCD9D3", "#A6A29B", "#F7F5F1", "#6F6B65"],
    },
    graphite: {
        label: "Graphite",
        c: ["#3A3A3D", "#1B1B1D", "#6A6A6E", "#0E0E10"],
    },
    coral: { label: "Coral", c: ["#EFA38C", "#C4664F", "#F9CDBE", "#9B4A37"] },
    sage: { label: "Sage", c: ["#C3CBB7", "#76816B", "#E0E6D8", "#5A6450"] },
}
const FINISH_KEYS = ["titanium", "graphite", "coral", "sage"] as const
const SCENES: { key: Scene; label: string }[] = [
    { key: "split", label: "Basic" },
    { key: "glow", label: "Glow" },
    { key: "orbit", label: "Orbit" },
]

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

// CSS for screen motion. Uses the individual `translate` / `scale` properties so it
// never fights Framer's own transforms. Classes are removed again after each reveal.
const EASE = "cubic-bezier(.16,1,.3,1)"
const LITE_CSS = `.ffm-lite *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}`

// ---------- page change: a still copy of the stage stays on screen while the next page mounts,
// then fades out over the new screen (Framer swaps the whole page tree; without this the
// device vanished for a moment and came back empty)
const SNAP_ID = "ff-pagesnap"
// [Z8] intro decision for this page load (see the opening-animation effect)
let ffLoad: { seen: boolean; intro: boolean | null } | null = null
const takeSnapshot = (stage: HTMLElement) => {
    if (typeof document === "undefined") return
    const prev = document.getElementById(SNAP_ID)
    if (prev) prev.remove()
    const r = stage.getBoundingClientRect()
    if (r.bottom <= 0 || r.top >= window.innerHeight || !r.width) return
    const clone = stage.cloneNode(true) as HTMLElement
    // canvases (Glow plates) don't copy their pixels with cloneNode
    const sc = stage.querySelectorAll("canvas")
    const cc = clone.querySelectorAll("canvas")
    sc.forEach((c, i) => {
        const d = cc[i] as HTMLCanvasElement | undefined
        const x = d && d.getContext("2d")
        if (x) {
            try {
                x.drawImage(c as HTMLCanvasElement, 0, 0)
            } catch (e) {}
        }
    })
    clone.style.position = "absolute"
    clone.style.left = "0"
    clone.style.top = "0"
    clone.style.margin = "0"
    const wrap = document.createElement("div")
    wrap.id = SNAP_ID
    wrap.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:5;pointer-events:none;overflow:hidden`
    wrap.appendChild(clone)
    document.body.appendChild(wrap)
    // nothing adopted it (a page without the device): let it go
    window.setTimeout(() => releaseSnapshot(400), 3000)
}
const releaseSnapshot = (ms: number) => {
    if (typeof document === "undefined") return
    const w = document.getElementById(SNAP_ID) as
        | (HTMLElement & { __fading?: boolean })
        | null
    if (!w || w.__fading) return
    w.__fading = true
    // a background tab gets no animation frames: just drop it (and never leave it behind)
    if (document.visibilityState === "hidden") {
        w.remove()
        return
    }
    window.setTimeout(() => w.remove(), ms + 250)
    const t0 = performance.now()
    const step = (t: number) => {
        const p = Math.min(1, (t - t0) / ms)
        w.style.opacity = String(+(1 - p * p).toFixed(3))
        if (p < 1) window.requestAnimationFrame(step)
        else w.remove()
    }
    window.requestAnimationFrame(step)
}
const MOTION_CSS = `
.ffm-on .ffm-t,.ffm-on .ffm-h,.ffm-on .ffm-i,.ffm-on .ffm-c{opacity:0}
.ffm-hover a [data-framer-background-image-wrapper]{overflow:hidden}
@media (hover: hover) and (pointer: fine){
.ffm-hover a [data-framer-background-image-wrapper] img{transition:scale .9s ${EASE}}
.ffm-hover a:hover [data-framer-background-image-wrapper] img{scale:1.06}
.ffm-hover [data-framer-name^="Button"]{transition:translate .45s ${EASE},filter .45s ease,box-shadow .45s ease}
.ffm-hover [data-framer-name^="Button"]:hover{translate:0 -3px;filter:brightness(1.08);box-shadow:0 12px 24px -12px rgba(0,0,0,.45)}
.ffm-hover [data-framer-name^="Button"]:active{translate:0 0;filter:brightness(.96)}
.ffm-hover [data-framer-name^="Row"]{transition:translate .5s ${EASE},opacity .4s ease}
.ffm-hover [data-framer-name^="Row"]:hover{translate:10px 0}
.ffm-hover [data-framer-name^="Card"]{transition:translate .6s ${EASE}}
.ffm-hover [data-framer-name^="Card"]:hover{translate:0 -4px}
.ffm-hover .ffh-b{transition:translate .45s ${EASE},filter .45s ease,box-shadow .45s ease}
.ffm-hover .ffh-b:hover{translate:0 -3px;filter:brightness(1.1);box-shadow:0 14px 26px -14px rgba(0,0,0,.5)}
.ffm-hover .ffh-b:active{translate:0 0;filter:brightness(.95)}
.ffm-hover .ffh-r{transition:translate .5s ${EASE},opacity .4s ease}
.ffm-hover .ffh-r:hover{translate:8px 0;opacity:.72}
.ffm-hover .ffh-k [data-framer-component-type="RichTextContainer"]{transition:translate .5s ${EASE}}
.ffm-hover .ffh-k:hover [data-framer-component-type="RichTextContainer"]{translate:4px 0}
}
@keyframes ffm-show{from{opacity:0;translate:0 14px}to{opacity:1;translate:0 0}}
.ffm-show{animation:ffm-show .55s ${EASE} both}
@media (prefers-reduced-motion: reduce){.ffm-on .ffm-t,.ffm-on .ffm-h,.ffm-on .ffm-i,.ffm-on .ffm-c{opacity:1;translate:none;filter:none;clip-path:none}.ffm-show{animation:none}}
`

const STORE_KEY = "foldfolio:style"
const STORE_EVENT = "foldfolio:style"

// ---------------------------------------------------------------- helpers

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
// Framer image CDN: ask for a small copy (orbit cards / glow don't need 2000px photos)
const sized = (src: string, px: number) =>
    src && src.indexOf("framerusercontent.com/images/") >= 0
        ? src.split("?")[0] + "?scale-down-to=" + px
        : src
const eio = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
const eo = (t: number) => 1 - Math.pow(1 - t, 3)
const mixHex = (a: string, b: string, t: number) => {
    const p = (h: string) => {
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
const toHex = (c: string) => {
    if (!c) return "#DCD9D3"
    if (c.startsWith("#")) return c
    const m = c.match(/\d+(\.\d+)?/g)
    if (!m) return "#DCD9D3"
    return (
        "#" +
        m
            .slice(0, 3)
            .map((v) => Math.round(+v).toString(16).padStart(2, "0"))
            .join("")
    )
}
function finishColors(finish: Finish, custom: string) {
    if (finish !== "custom") return FINISHES[finish].c
    const base = toHex(custom)
    return [
        base,
        mixHex(base, "#000000", 0.28),
        mixHex(base, "#FFFFFF", 0.55),
        mixHex(base, "#000000", 0.5),
    ]
}
function readStore(): { scene?: Scene; finish?: Finish } {
    try {
        return JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}")
    } catch (e) {
        return {}
    }
}
function first(node: React.ReactNode): React.ReactElement | null {
    const arr = React.Children.toArray(node)
    return (arr[0] as React.ReactElement) || null
}
// Render a connected frame at the width we decide (height stays the frame's own).
function Slot({
    node,
    width,
    style,
}: {
    node: React.ReactElement | null
    width?: number | string
    style?: React.CSSProperties
}) {
    if (!node) return null
    const s = (node.props && (node.props as any).style) || {}
    return React.cloneElement(node as React.ReactElement<any>, {
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

// ---------------------------------------------------------------- component

interface Props {
    mode: Mode
    screen?: React.ReactNode
    screenPortrait?: React.ReactNode
    cover?: React.ReactNode
    coverPortrait?: React.ReactNode
    call?: React.ReactNode
    callPortrait?: React.ReactNode
    nav?: React.ReactNode
    navPortrait?: React.ReactNode
    nameLeft?: React.ReactNode
    nameRight?: React.ReactNode
    backdrop?: React.ReactNode // [BG]
    scene: Scene
    basicTone?: "tint" | "white" | "two"
    intro?: { on?: boolean; color?: string; line?: string; speed?: number }
    sceneImages?: { src: string; alt?: string }[]
    finish: Finish
    customFinish: string
    screenColor: string
    switcher: {
        show: boolean
        bottom: number
        scenesAt?: "header" | "bottom"
        top?: number
        right?: number
    }
    status: {
        show: boolean
        time: string
        live: boolean
        tone: "auto" | "light" | "dark"
    }
    layout: {
        orientation: Orientation
        portraitBelow: number
        top: number
        bottom: number
        maxScale: number
    }
    motion: {
        openLength: number
        closeLength: number
        holdLength: number
        smoothing: number
        float: boolean
        glass?: boolean
    }
    screenMotion: ScreenMotion
    preview: number
    style?: React.CSSProperties
}

// Motion inside the screens. Works on your own frames, no setup needed:
// - text fades up, big headings (H1/H2 text styles) rise out of a mask
// - frames with an image fill open up (image reveal)
// - a frame named "Count…" counts its number up (e.g. "140+", "12", "98%")
// - hover: images inside links zoom, layers named "Button…" lift, "Row…" slide
type ScreenMotion = {
    on: boolean
    headlines: boolean
    images: boolean
    counters: boolean
    hover: boolean
    duration: number
    distance: number
    stagger: number
}
const MOTION_DEFAULTS: ScreenMotion = {
    on: true,
    headlines: true,
    images: true,
    counters: true,
    hover: true,
    duration: 1,
    distance: 26,
    stagger: 0.06,
}
type MItem = {
    el: HTMLElement
    root: HTMLElement
    top: number
    h: number
    kind: "t" | "h" | "i" | "c"
    done: boolean
}
type Reveal = {
    el: HTMLElement
    img: HTMLElement | null
    kind: MItem["kind"]
    t0: number
    dur: number
    dist: number
}
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3)

/**
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight auto
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 820
 * @framerDisableUnlink
 */
export default function FoldfolioDevice(props: Props) {
    const {
        mode,
        scene: sceneProp,
        finish: finishProp,
        customFinish,
        screenColor,
        switcher,
        status,
        layout,
        motion,
        preview,
    } = props
    const isCanvas =
        RenderTarget.current() === RenderTarget.canvas ||
        RenderTarget.current() === RenderTarget.thumbnail

    // ---------- viewport + orientation
    const rootRef = useRef<HTMLDivElement>(null)
    const [vp, setVp] = useState({ w: 1200, h: 820 })
    useIsoLayoutEffect(() => {
        if (typeof window === "undefined") return
        const measure = () => {
            const w = rootRef.current
                ? rootRef.current.offsetWidth || window.innerWidth
                : window.innerWidth
            const h = isCanvas ? 820 : window.innerHeight
            startTransition(() =>
                setVp((p) => {
                    // ignore small height-only jumps (mobile address bar) to avoid layout jumps
                    if (
                        !isCanvas &&
                        p.w === w &&
                        Math.abs(p.h - h) < 110 &&
                        w < 900
                    )
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
    }, [isCanvas])

    const port =
        layout.orientation === "portrait" ||
        (layout.orientation === "auto" &&
            (vp.w < layout.portraitBelow || vp.w / vp.h < 0.85))
    const G = port ? GEO.portrait : GEO.landscape
    const b = G.f + G.bz
    const Ws = G.W - 2 * b // full screen width
    const Hs = G.H - 2 * b // full screen height
    const halfW = port ? Ws : G.W / 2 - b // one half-screen
    const halfH = port ? G.H / 2 - b : Hs
    const land = !port
    const rad = (tl: number, tr: number, br: number, bl: number) =>
        `${tl}px ${tr}px ${br}px ${bl}px`
    const Ro = G.R
    // corners per piece: outer corners rounded, hinge side square (the halves meet there)
    const cLeaf = land ? rad(Ro, 0, 0, Ro) : rad(Ro, Ro, 0, 0)
    const cRight = land ? rad(0, Ro, Ro, 0) : rad(0, 0, Ro, Ro)
    const cAll = rad(Ro, Ro, Ro, Ro)
    const inner = (r: string, off: number) =>
        r
            .split(" ")
            .map((v) =>
                parseFloat(v) > 0
                    ? Math.max(0, parseFloat(v) - off) + "px"
                    : "0px"
            )
            .join(" ")

    // ---------- style (scene + finish), shared across pages through localStorage
    const [pick, setPick] = useState<{ scene: Scene; finish: Finish }>({
        scene: sceneProp,
        finish: finishProp,
    })
    useEffect(() => {
        if (typeof window === "undefined" || isCanvas || !switcher.show) {
            setPick({ scene: sceneProp, finish: finishProp })
            return
        }
        const sync = () => {
            const s = readStore()
            startTransition(() =>
                setPick({
                    scene: s.scene || sceneProp,
                    finish: s.finish || finishProp,
                })
            )
        }
        sync()
        window.addEventListener(STORE_EVENT, sync)
        window.addEventListener("storage", sync)
        return () => {
            window.removeEventListener(STORE_EVENT, sync)
            window.removeEventListener("storage", sync)
        }
    }, [sceneProp, finishProp, switcher.show, isCanvas])
    const choose = (p: Partial<{ scene: Scene; finish: Finish }>) => {
        const next = { ...pick, ...p }
        setPick(next)
        try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(next))
            window.dispatchEvent(new Event(STORE_EVENT))
        } catch (e) {}
    }
    const scene = pick.scene
    const F = finishColors(pick.finish, customFinish)

    // ---------- scale to fit the stage
    const stageH = vp.h
    const availH = Math.max(
        200,
        stageH -
            layout.top -
            (switcher.show
                ? Math.max(layout.bottom, switcher.bottom + 64)
                : layout.bottom)
    )
    const availW = vp.w * (port ? 0.94 : 0.9)
    const s = Math.min(availW / G.W, availH / G.H, layout.maxScale)
    // the hinge sits on whole screen pixels (no blurred seam between the two halves)
    const cy = Math.round(layout.top + availH / 2)
    const cx = Math.round(vp.w / 2)
    const hingeBleed = 0 // the halves meet on a whole screen pixel (see cx / measureTop): no overlap needed

    // ---------- slots
    const screenNode = first(
        port && first(props.screenPortrait)
            ? props.screenPortrait
            : props.screen
    )
    const coverNode = first(
        port && first(props.coverPortrait) ? props.coverPortrait : props.cover
    )
    const callNode = first(
        port && first(props.callPortrait) ? props.callPortrait : props.call
    )
    const navNode = first(
        port && first(props.navPortrait) ? props.navPortrait : props.nav
    )
    const nameL = first(props.nameLeft)
    const nameR = first(props.nameRight)

    // ---------- measure the Screen content height
    const measureRef = useRef<HTMLDivElement>(null)
    const [contentH, setContentH] = useState(Hs)
    // the stage gets the page's own background colour: an opaque stage lets the browser skip
    // drawing the page underneath it (less graphics memory, no half-drawn frames)
    const [pageBg, setPageBg] = useState("")
    useEffect(() => {
        if (isCanvas || typeof window === "undefined" || !rootRef.current)
            return
        let el: HTMLElement | null = rootRef.current.parentElement
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
    }, [isCanvas])
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
    }, [Hs, port, mode])
    const innerMax = Math.max(0, contentH - Hs)

    // ---------- scroll phases (page pixels)
    const U1 = mode === "fold" ? stageH * motion.openLength : 0
    const U2 = mode === "fold" ? stageH * motion.closeLength : 0
    const U3 = mode === "fold" ? stageH * motion.holdLength : 0
    const innerPx = innerMax * s // scroll distance that moves the content at natural speed
    const totalH = isCanvas ? 820 : stageH + U1 + innerPx + U2 + U3

    // ---------- names (Split scene): measure natural sizes
    const nlRef = useRef<HTMLDivElement>(null)
    const nrRef = useRef<HTMLDivElement>(null)
    const [nameSize, setNameSize] = useState({ lw: 1, lh: 1, rw: 1, rh: 1 })
    useEffect(() => {
        if (typeof ResizeObserver === "undefined") return
        const upd = () => {
            const l = nlRef.current,
                r = nrRef.current
            // natural size of the name frames (robust even when the frame reports 0)
            const size = (el: HTMLElement | null) => {
                if (!el) return { w: 1, h: 1 }
                let w = Math.max(el.offsetWidth, el.scrollWidth)
                let h = Math.max(el.offsetHeight, el.scrollHeight)
                el.querySelectorAll("*").forEach((c) => {
                    const e = c as HTMLElement
                    w = Math.max(w, e.offsetWidth || 0)
                    h = Math.max(h, e.offsetHeight || 0)
                })
                return { w: Math.max(1, w), h: Math.max(1, h) }
            }
            const a = size(l),
                b3 = size(r)
            const n = { lw: a.w, lh: a.h, rw: b3.w, rh: b3.h }
            startTransition(() =>
                setNameSize((p) =>
                    p.lw === n.lw &&
                    p.lh === n.lh &&
                    p.rw === n.rw &&
                    p.rh === n.rh
                        ? p
                        : n
                )
            )
        }
        upd()
        const ts = [300, 1200].map((d) => window.setTimeout(upd, d))
        const ro = new ResizeObserver(upd)
        if (nlRef.current) ro.observe(nlRef.current)
        if (nrRef.current) ro.observe(nrRef.current)
        return () => {
            ts.forEach((t) => window.clearTimeout(t))
            ro.disconnect()
        }
    }, [scene, nameL, nameR])

    // ---------- the animation loop (direct DOM writes, no re-render per frame)
    const R = {
        stage: useRef<HTMLDivElement>(null),
        iCur: useRef<HTMLDivElement>(null),
        iA: useRef<HTMLDivElement>(null),
        iB: useRef<HTMLDivElement>(null),
        iSeam: useRef<HTMLDivElement>(null),
        iDev: useRef<HTMLDivElement>(null),
        iNames: useRef<HTMLDivElement>(null),
        dev: useRef<HTMLDivElement>(null),
        leaf: useRef<HTMLDivElement>(null),
        cover: useRef<HTMLDivElement>(null),
        rightH: useRef<HTMLDivElement>(null),
        rBody: useRef<HTMLDivElement>(null),
        rGlass: useRef<HTMLDivElement>(null),
        rScreen: useRef<HTMLDivElement>(null),
        cL: useRef<HTMLDivElement>(null),
        cR: useRef<HTMLDivElement>(null),
        cOpen: useRef<HTMLDivElement>(null),
        shF: useRef<HTMLDivElement>(null),
        shB: useRef<HTMLDivElement>(null),
        shR: useRef<HTMLDivElement>(null),
        shadow: useRef<HTMLDivElement>(null),
        shadowC: useRef<HTMLDivElement>(null),
        call: useRef<HTMLDivElement>(null),
        overlay: useRef<HTMLDivElement>(null),
        nmL: useRef<HTMLDivElement>(null),
        nmR: useRef<HTMLDivElement>(null),
        glow: useRef<HTMLDivElement>(null),
        glowR: useRef<HTMLDivElement>(null),
        orbit: useRef<HTMLDivElement>(null),
        rig: useRef<HTMLDivElement>(null),
        openBlk: useRef<HTMLDivElement>(null),
        wA: useRef<HTMLDivElement>(null),
        wB: useRef<HTMLDivElement>(null),
        plateL: useRef<HTMLDivElement>(null), // [Z8]
        plateR: useRef<HTMLDivElement>(null), // [Z8]
    }
    const imgs = (props.sceneImages || []).filter((x) => x && x.src)
    const glowCur = useRef("")
    const glowFlip = useRef(0)
    // images for Glow / Orbit: your Scene Images, or (automatically) the images in the Screen
    const autoImgs = useRef<{ src: string; top: number }[]>([])
    const sceneList = () =>
        imgs.length
            ? imgs.map((x, i) => ({ src: x.src, top: i * 600 }))
            : autoImgs.current

    const geo = useRef({
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
        scene,
        nameSize,
        imgs,
        mode,
        cRight,
        cAll,
        inner,
    })
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
        scene,
        nameSize,
        imgs,
        mode,
        cRight,
        cAll,
        inner,
    }

    // Write a style only when it changes (keeps the browser from re-doing work every frame)
    const cache = useRef<WeakMap<HTMLElement, Record<string, string>>>(
        typeof WeakMap !== "undefined" ? new WeakMap() : (null as any)
    )
    const S = (el: HTMLElement | null | undefined, k: string, v: string) => {
        if (!el) return
        let c = cache.current.get(el)
        if (!c) cache.current.set(el, (c = {}))
        if (c[k] !== v) {
            c[k] = v
            if (k.charCodeAt(0) === 45) el.style.setProperty(k, v)
            else (el.style as any)[k] = v
        }
    }
    const live = useRef<{
        k: number
        inner: number
        cur: number
        tint: string
        bars: HTMLElement[] | null
        rc: string
        pe: number
    }>({ k: -1, inner: -1, cur: 0, tint: "", bars: null, rc: "", pe: 0 })
    const tintMap = useRef<
        {
            top: number
            lum: number
            lumR: number
            src?: string
            srcR?: string
        }[]
    >([])
    // top-strip brightness of screen images (for the status bar over an image)
    const imgLum = useRef<Record<string, number>>({})
    const topRef = useRef(0)
    const kick = useRef<() => void>(() => {})
    // after every React render: forget cached styles and redraw once with the new geometry
    useIsoLayoutEffect(() => {
        cache.current = new WeakMap()
        live.current.k = -1
        live.current.inner = -1
        live.current.tint = ""
        live.current.bars = null
        live.current.rc = ""
        paintScenes.current()
        renderFrame.current(live.current.cur, performance.now())
        kick.current()
    })
    const renderFrame = useRef<(scrolled: number, t: number) => void>(() => {})
    renderFrame.current = (sc: number, t: number) => {
        const g = geo.current
        const { G: Gd, port: P } = g
        let p1 = 1,
            p3 = 0,
            inner = 0
        if (g.mode === "fold") {
            p1 = g.U1 > 0 ? clamp(sc / (g.U1 * 0.9), 0, 1) : 1
            inner = clamp((sc - g.U1) / (g.s || 1), 0, g.innerMax)
            p3 =
                g.U2 > 0
                    ? clamp(
                          (sc - g.U1 - g.innerPx - g.U2 * 0.08) / (g.U2 * 0.92),
                          0,
                          1
                      )
                    : 0
        } else {
            inner = clamp(sc / (g.s || 1), 0, g.innerMax)
        }
        const pe = g.mode === "fold" ? eio(p1) * (1 - eio(p3)) : 1 // 1 = fully open
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
            const hide = g.mode === "fold" && k > 0.985 ? "hidden" : "inherit"
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
            S(R.cOpen.current, "top", y + "px")
            L.inner = inner
            motionTick.current(inner, pe)
        }

        // ---- scenes
        const vw = g.vw
        const DW = Gd.W * g.s,
            DH = Gd.H * g.s
        if (g.scene === "split" && kChanged && R.nmL.current && R.nmR.current) {
            const ns = g.nameSize
            const nl = R.nmL.current,
                nr = R.nmR.current
            if (!P) {
                const closedW = DW / 2
                const side = (vw - closedW) / 2
                const tuck = closedW * 0.06 // slide a little behind the device: no gap
                const maxH = g.stageH * 0.42
                const sl = Math.min(
                    (side - vw * 0.03 + tuck) / ns.lw,
                    maxH / ns.lh
                )
                const sr = Math.min(
                    (side - vw * 0.03 + tuck) / ns.rw,
                    maxH / ns.rh
                )
                const push = closedW / 2 - tuck + (vw * 0.22 + DW / 4) * eo(pe)
                S(
                    nl,
                    "transform",
                    `translate(calc(${(vw / 2 - push).toFixed(1)}px - 100%), ${g.cy}px) translateY(-50%) scale(${sl.toFixed(4)})`
                )
                S(nl, "transformOrigin", "100% 50%")
                S(
                    nr,
                    "transform",
                    `translate(${(vw / 2 + push).toFixed(1)}px, ${g.cy}px) translateY(-50%) scale(${sr.toFixed(4)})`
                )
                S(nr, "transformOrigin", "0% 50%")
            } else {
                const closedH = DH / 2
                const space = (g.stageH - closedH) / 2
                const sl = Math.min((vw * 0.86) / ns.lw, (space * 0.62) / ns.lh)
                const sr = Math.min((vw * 0.86) / ns.rw, (space * 0.62) / ns.rh)
                const off = closedH / 2 + space * 0.1
                const slide = vw * 0.8 * eo(pe)
                S(
                    nl,
                    "transform",
                    `translate(calc(${(vw / 2 - slide).toFixed(1)}px - 50%), calc(${g.cy - off}px - 100%)) scale(${sl.toFixed(4)})`
                )
                S(nl, "transformOrigin", "50% 100%")
                S(
                    nr,
                    "transform",
                    `translate(calc(${(vw / 2 + slide).toFixed(1)}px - 50%), ${g.cy + off}px) scale(${sr.toFixed(4)})`
                )
                S(nr, "transformOrigin", "50% 0%")
            }
            const op = String(+(1 - pe * 0.9).toFixed(3))
            S(nl, "opacity", op)
            S(nr, "opacity", op)
        }
        if (g.scene === "glow" && R.glow.current) {
            const list = sceneList()
            if (list.length) {
                // closed: the most colourful image; open: the colourful image nearest the middle
                const sv = (src: string) =>
                    sat.current[src] === undefined ? 0.3 : sat.current[src]
                let want = list[0].src
                if (pe > 0.35 && p3 < 0.5) {
                    const mid = inner + g.Hs / 2
                    let best = Infinity
                    for (const it of list) {
                        const d =
                            Math.abs(it.top - mid) +
                            (sv(it.src) < 0.16 ? 2500 : 0)
                        if (d < best) {
                            best = d
                            want = it.src
                        }
                    }
                } else {
                    let best = -1
                    for (const it of list) {
                        if (sv(it.src) > best) {
                            best = sv(it.src)
                            want = it.src
                        }
                    }
                }
                if (want !== glowCur.current) {
                    glowCur.current = want
                    glowFlip.current = 1 - glowFlip.current
                    const f = glowFlip.current
                    ;[R.glow.current, R.glowR.current].forEach((box) => {
                        if (!box) return
                        const kids = box.children
                        const a = kids[f] as HTMLCanvasElement,
                            b2 = kids[1 - f] as HTMLCanvasElement
                        if (a) {
                            drawGlow(a, want)
                            a.style.opacity = "1"
                        }
                        if (b2) b2.style.opacity = "0"
                    })
                }
            }
            if (kChanged) {
                const gs = P ? 1 : 0.55 + 0.45 * pe
                S(
                    R.glow.current,
                    "transform",
                    `translate(-50%, -50%) scaleX(${gs.toFixed(4)})`
                )
                S(
                    R.glow.current,
                    "opacity",
                    String(+(0.75 + 0.2 * pe).toFixed(3))
                )
                S(
                    R.glowR.current,
                    "transform",
                    `translateX(-50%) scaleX(${gs.toFixed(4)}) scaleY(-1)`
                )
                S(
                    R.glowR.current,
                    "opacity",
                    String(+(0.3 + 0.25 * pe).toFixed(3))
                )
            }
        }
        // ---- status bar auto tint: look up the section under it (precomputed, no layout reads)
        if (
            status.tone !== "light" &&
            status.tone !== "dark" &&
            tintMap.current.length
        ) {
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
                    ? (Array.from(
                          rootRef.current.querySelectorAll("[data-ffsb]")
                      ) as HTMLElement[])
                    : []
                L.bars.forEach((el) => {
                    el.style.color = el.dataset.ffsb === "right" ? colR : colL
                    // one bar across an open landscape screen: its right group (5G, battery) follows the right side
                    if (el.dataset.ffsb === "all" && !P) {
                        const r = el.lastElementChild as HTMLElement | null
                        if (r) r.style.color = colR
                    }
                })
            }
        }
        if (g.scene === "orbit" && R.orbit.current) {
            const cards = R.orbit.current.children
            let n = cards.length
            while (
                n > 1 &&
                (cards[n - 1] as HTMLElement).style.display === "none"
            )
                n--
            // closed: a tight ring around the phone; open: a wide ring that peeks around the display
            const rx = P
                ? vw * (0.5 + 0.06 * pe)
                : DW * (0.2 + 0.38 * k + 0.42 * pe)
            const ry = P
                ? g.stageH * (0.34 + 0.1 * pe)
                : DH * (0.2 + 0.26 * k + 0.34 * pe)
            for (let i = 0; i < n; i++) {
                const c = cards[i] as HTMLElement
                const a = t * 0.00012 + (i * Math.PI * 2) / n
                const z = Math.cos(a)
                const x = Math.sin(a) * rx
                const y =
                    g.cy + z * ry * 0.9 + Math.sin(a * 2 + i * 1.7) * DH * 0.03
                const scl =
                    (0.72 + (0.38 * (z + 1)) / 2) *
                    (0.55 + 0.45 * k + 0.25 * pe)
                c.style.transform = `translate3d(${(vw / 2 + x).toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${scl.toFixed(3)}) rotate(${(Math.sin(a + i) * 8).toFixed(2)}deg)`
                S(c, "zIndex", z > 0 && k > 0.5 ? "4" : "2")
                S(
                    c,
                    "opacity",
                    String(
                        +(
                            (z > 0 ? 1 : 0.5 + 0.5 * (z + 1)) *
                            (0.85 + 0.15 * k)
                        ).toFixed(2)
                    )
                )
            }
        }
    }

    // ---------- screen motion: reveal / image reveal / headline mask / count-up
    const mo: ScreenMotion = Object.assign(
        {},
        MOTION_DEFAULTS,
        props.screenMotion
    )
    const motionOn = mo.on && !isCanvas
    const introCfg = Object.assign(
        { on: true, color: "", line: "rgba(17,17,17,.55)", speed: 1 },
        props.intro
    )
    const introLive = !!introCfg.on && !isCanvas
    const mItems = useRef<MItem[]>([])
    const seen = useRef<WeakSet<HTMLElement>>(
        typeof WeakSet !== "undefined" ? new WeakSet() : (null as any)
    )
    const primed = useRef<WeakSet<HTMLImageElement>>(
        typeof WeakSet !== "undefined" ? new WeakSet() : (null as any)
    )
    const scan = useRef<() => void>(() => {})
    scan.current = () => {
        if (typeof document === "undefined" || isCanvas) return
        const roots = [R.cL.current, R.cR.current, R.cOpen.current].filter(
            Boolean
        ) as HTMLElement[]
        const list: MItem[] = []
        const topOf = (el: HTMLElement, root: HTMLElement) => {
            let y = 0
            let e: HTMLElement | null = el
            while (e && e !== root) {
                y += e.offsetTop
                e = e.offsetParent as HTMLElement | null
            }
            return y
        }
        // images in the Screen feed the Glow / Orbit backgrounds automatically
        const main = R.cOpen.current || R.cR.current || R.cL.current
        if (main) {
            const found: { src: string; top: number }[] = []
            const have = new Set<string>()
            main.querySelectorAll(
                "[data-framer-background-image-wrapper] img"
            ).forEach((im) => {
                const img = im as HTMLImageElement
                const src = img.currentSrc || img.src
                const key = src.split("?")[0]
                const box = img.closest(
                    "[data-framer-background-image-wrapper]"
                ) as HTMLElement
                if (!src || have.has(key) || !box || box.offsetWidth < 120)
                    return
                have.add(key)
                found.push({
                    src,
                    top: topOf(box, main) + box.offsetHeight / 2,
                })
            })
            found.sort((a, b) => a.top - b.top)
            const changed =
                found.map((f) => f.src).join() !==
                autoImgs.current.map((f) => f.src).join()
            autoImgs.current = found
            found.forEach((f) => measureSat(f.src))
            if (changed) paintScenes.current()
        }
        // sections of the Screen and how bright they are (for the status bar tint)
        if (main) {
            const lumOf = (el: Element | null): number => {
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
                const n =
                    parseInt(toHex(String(screenColor)).slice(1, 7), 16) || 0
                return (
                    (0.2126 * ((n >> 16) & 255) +
                        0.7152 * ((n >> 8) & 255) +
                        0.0722 * (n & 255)) /
                    255
                )
            }
            const slotRoot = (main.firstElementChild &&
                main.firstElementChild.firstElementChild) as HTMLElement | null
            const secs: {
                top: number
                lum: number
                lumR: number
                src?: string
                srcR?: string
            }[] = []
            // the deepest layer under a point near the top-left / top-right corner of a section
            // (a two-column section can be dark on one side and an image on the other)
            const edge = (
                el: HTMLElement,
                side: "left" | "right"
            ): { lum: number; src?: string } => {
                let cur = el
                const r0 = cur.getBoundingClientRect()
                const px = side === "left" ? r0.left + 24 : r0.right - 24
                const py = r0.top + 18
                for (let d = 0; d < 8; d++) {
                    const kids = Array.from(cur.children) as HTMLElement[]
                    let hit: HTMLElement | null = null
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
                        cur.tagName === "IMG" ? (cur as HTMLImageElement) : null
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
                    const el = c as HTMLElement
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
        // big type never spills out of the screen: a heading wider than its box wraps
        // (several words) or scales down (one long word), recomputed on every layout
        const fitText = () => {
            const ref = R.cOpen.current || R.cR.current || R.cL.current
            if (!ref) return
            const RTC = '[data-framer-component-type="RichTextContainer"]'
            const lists = roots.map(
                (r) => Array.from(r.querySelectorAll(RTC)) as HTMLElement[]
            )
            const kidsOf = (el: HTMLElement) =>
                Array.from(
                    el.querySelectorAll("h1,h2,h3,h4,h5,h6,p")
                ) as HTMLElement[]
            // reset every copy, then measure the reference copy (never turned in 3D)
            lists.forEach((l) =>
                l.forEach((el) => {
                    if (!el.dataset.fffit) return
                    el.style.maxWidth = ""
                    el.style.whiteSpace = ""
                    ;(el.style as any).zoom = ""
                    kidsOf(el).forEach((c) => {
                        c.style.whiteSpace = ""
                        c.style.overflowWrap = ""
                        c.style.wordBreak = ""
                    })
                    delete el.dataset.fffit
                })
            )
            if (!ref.offsetWidth) return
            // layout geometry (offsets), so 3D turns, scaling and reveal motion never skew it
            const leftOf = (el: HTMLElement) => {
                let x = 0
                let e: HTMLElement | null = el
                while (e && e !== ref) {
                    x += e.offsetLeft
                    e = e.offsetParent as HTMLElement | null
                }
                return e === ref ? x : NaN
            }
            const fixes: { i: number; mw: string; wrap: boolean; z: string }[] =
                []
            ;(Array.from(ref.querySelectorAll(RTC)) as HTMLElement[]).forEach(
                (el, i) => {
                    if (!el.offsetWidth) return
                    const fs =
                        parseFloat(
                            window.getComputedStyle(el.firstElementChild || el)
                                .fontSize
                        ) || 0
                    if (fs < 18) return
                    const x0 = leftOf(el)
                    if (isNaN(x0)) return
                    const right = x0 + Math.max(el.offsetWidth, el.scrollWidth)
                    // the nearest box this text visibly sticks out of: the screen itself, or a
                    // box that clips or has a fill (a card, a dark band). Spilling past a
                    // transparent layout box is invisible and left alone.
                    let lim = Infinity
                    let a = el.parentElement
                    while (a && a !== ref.parentElement) {
                        const ax = a === ref ? 0 : leftOf(a)
                        if (!isNaN(ax) && a.clientWidth) {
                            const cs = window.getComputedStyle(a)
                            const bg = cs.backgroundColor
                            const seen =
                                a === ref ||
                                cs.overflowX !== "visible" ||
                                (bg !== "transparent" &&
                                    !/rgba\(.*,\s*0\)$/.test(bg)) ||
                                cs.backgroundImage !== "none"
                            if (seen && ax + a.offsetWidth < right - 2) {
                                lim =
                                    ax +
                                    a.clientLeft +
                                    a.clientWidth -
                                    (parseFloat(cs.paddingRight) || 0)
                                break
                            }
                        }
                        a = a.parentElement
                    }
                    if (lim === Infinity) return
                    const avail = lim - x0
                    if (avail < 40) return
                    const k = 1
                    const f = { i, mw: "", wrap: false, z: "" }
                    el.dataset.fffit = "1"
                    if (
                        /\s/.test((el.textContent || "").trim()) &&
                        el.scrollWidth <= el.offsetWidth + 1
                    ) {
                        f.wrap = true
                        f.mw = avail / k + "px"
                        el.style.maxWidth = f.mw
                        el.style.whiteSpace = "pre-wrap"
                        kidsOf(el).forEach((c) => {
                            c.style.whiteSpace = "pre-wrap"
                            c.style.overflowWrap = "normal"
                            c.style.wordBreak = "normal"
                        })
                    }
                    const w = Math.max(el.offsetWidth, el.scrollWidth)
                    if (w > avail + 1) {
                        const z = Math.max(0.35, avail / w)
                        f.z = z.toFixed(4)
                        ;(el.style as any).zoom = f.z
                        if (f.mw) {
                            f.mw = avail / k / z + "px"
                            el.style.maxWidth = f.mw
                        }
                    }
                    fixes.push(f)
                }
            )
            // the same fix on the other copies (the halves show the same screen)
            roots.forEach((r, ri) => {
                if (r === ref) return
                fixes.forEach((f) => {
                    const el = lists[ri][f.i]
                    if (!el) return
                    el.dataset.fffit = "1"
                    if (f.mw) el.style.maxWidth = f.mw
                    if (f.wrap) {
                        el.style.whiteSpace = "pre-wrap"
                        kidsOf(el).forEach((c) => {
                            c.style.whiteSpace = "pre-wrap"
                            c.style.overflowWrap = "normal"
                            c.style.wordBreak = "normal"
                        })
                    }
                    if (f.z) (el.style as any).zoom = f.z
                })
            })
        }
        fitText()
        if (document.fonts && document.fonts.ready)
            document.fonts.ready.then(() => fitText())
        // load + decode every screen image up front: no loading/decoding hitches while scrolling
        roots.forEach((root) =>
            root.querySelectorAll("img").forEach((im) => {
                const img = im as HTMLImageElement
                if (primed.current.has(img)) return
                primed.current.add(img)
                if (img.loading === "lazy") img.loading = "eager"
                if (img.decode) img.decode().catch(() => {})
            })
        )
        if (!motionOn && !mo.hover) return
        roots.forEach((root) => {
            const add = (el: HTMLElement | null, kind: MItem["kind"]) => {
                if (!motionOn || !el || seen.current.has(el)) return
                seen.current.add(el)
                el.classList.add("ffm-" + kind)
                list.push({ el, root, top: 0, h: 0, kind, done: false })
            }
            if (mo.images)
                root.querySelectorAll(
                    "[data-framer-background-image-wrapper]"
                ).forEach((w) => add(w.parentElement as HTMLElement, "i"))
            root.querySelectorAll(
                '[data-framer-component-type="RichTextContainer"]'
            ).forEach((t) => {
                const tag =
                    (t.firstElementChild && t.firstElementChild.tagName) || ""
                // big numbers ("12", "140+", "9") count up automatically
                const txt = ((t as HTMLElement).innerText || "").trim()
                const big =
                    mo.counters &&
                    /^\D{0,2}\d[\d,.]*\D{0,4}$/.test(txt) &&
                    parseFloat(
                        window.getComputedStyle(t.firstElementChild || t)
                            .fontSize
                    ) >= 34
                add(
                    t as HTMLElement,
                    big
                        ? "c"
                        : mo.headlines && (tag === "H1" || tag === "H2")
                          ? "h"
                          : "t"
                )
            })
            // hover styles for links, detected from their look
            if (mo.hover)
                root.querySelectorAll("a").forEach((a) => {
                    const el = a as HTMLElement
                    if (el.dataset.ffh) return
                    const cs = window.getComputedStyle(el)
                    const hasBg =
                        cs.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                        cs.backgroundColor !== "transparent"
                    const round = parseFloat(cs.borderTopLeftRadius) >= 12
                    const hasImg = !!el.querySelector(
                        "[data-framer-background-image-wrapper]"
                    )
                    let k = ""
                    if (hasBg && round && el.offsetWidth < 420 && !hasImg)
                        k = "b"
                    else if (
                        !hasImg &&
                        el.offsetWidth > root.clientWidth * 0.55
                    )
                        k = "r"
                    else if (hasImg) k = "k"
                    if (k) {
                        el.dataset.ffh = k
                        el.classList.add("ffh-" + k)
                    }
                })
            if (mo.counters)
                root.querySelectorAll(
                    '[data-framer-name^="Count"],[data-framer-name^="count"]'
                ).forEach((c) => add(c as HTMLElement, "c"))
        })
        kick.current()
        mItems.current = mItems.current
            .filter((m) => !m.done && m.el.isConnected)
            .concat(list)
        mItems.current.forEach((m) => {
            m.top = topOf(m.el, m.root)
            m.h = m.el.offsetHeight
        })
        // whatever is already on screen shows now (no waiting for the first scroll)
        if (list.length)
            motionTick.current(Math.max(0, live.current.inner), live.current.pe)
    }
    const countUp = (el: HTMLElement) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
        let node: Text | null = null
        while (walker.nextNode()) {
            const n = walker.currentNode as Text
            if (/\d/.test(n.nodeValue || "")) {
                node = n
                break
            }
        }
        if (!node) return
        const txt = node.nodeValue || ""
        const m = txt.match(/^(\D*)(\d[\d,.]*)(.*)$/)
        if (!m) return
        const raw = m[2].replace(/,/g, "")
        const target = parseFloat(raw)
        const dec = raw.includes(".") ? raw.split(".")[1].length : 0
        const pad = !dec && raw.startsWith("0") ? raw.length : 0
        const comma = m[2].includes(",")
        const fmt = (v: number) => {
            let s = v.toFixed(dec)
            if (pad) s = s.padStart(pad, "0")
            if (comma)
                s = Number(s).toLocaleString("en-US", {
                    minimumFractionDigits: dec,
                })
            return m[1] + s + m[3]
        }
        const t0 = performance.now()
        const dur = 1400 + Math.min(1200, target * 4)
        const tn = node
        const step = (now: number) => {
            const p = clamp((now - t0) / dur, 0, 1)
            tn.nodeValue = fmt(
                target * (1 - Math.pow(2, -10 * p)) * (p === 1 ? 1 : 1.0009)
            )
            if (p < 1) window.requestAnimationFrame(step)
            else tn.nodeValue = txt
        }
        tn.nodeValue = fmt(0)
        window.requestAnimationFrame(step)
        window.setTimeout(() => (tn.nodeValue = txt), dur + 400) // safety
    }
    const motionTick = useRef<(inner: number, pe: number) => void>(() => {})
    motionTick.current = (inner: number, pe: number) => {
        if (!motionOn || !mItems.current.length) return
        if (pe < 0.55) return // wait until the display is (almost) open
        const g = geo.current
        const lo = inner - 40
        const hi = inner + g.Hs * (g.port ? 1 : 0.94)
        let n = 0
        for (const m of mItems.current) {
            if (m.done || m.top > hi || m.top + m.h < lo) continue
            m.done = true
            const d = Math.min(n * mo.stagger, 0.6)
            n++
            const el = m.el
            const img =
                m.kind === "i"
                    ? (el.querySelector(
                          "[data-framer-background-image-wrapper] img"
                      ) as HTMLElement | null)
                    : null
            const dur =
                mo.duration *
                (m.kind === "h" ? 1.15 : m.kind === "c" ? 1 : 0.9) *
                1000
            el.style.transition = "none"
            if (img) img.style.transition = "none"
            reveals.current.push({
                el,
                img,
                kind: m.kind,
                t0: performance.now() + d * 1000,
                dur,
                dist:
                    m.kind === "c"
                        ? mo.distance * 0.6
                        : m.kind === "h"
                          ? 12
                          : mo.distance,
            })
            if (m.kind === "c")
                window.setTimeout(() => countUp(el), d * 1000 + 150)
        }
        if (n) {
            mItems.current = mItems.current.filter((m) => !m.done)
            kick.current()
        }
    }
    // reveals are stepped from the loop: plain style writes, no CSS transitions, so the
    // browser never has to create extra layers for them
    const reveals = useRef<Reveal[]>([])
    const stepReveals = (t: number) => {
        const list = reveals.current
        if (!list.length) return false
        let keep = false
        for (const r of list) {
            const p = clamp((t - r.t0) / r.dur, 0, 1)
            const e = easeOut(p)
            r.el.style.opacity = String(+e.toFixed(3))
            if (r.kind !== "i")
                r.el.style.translate = `0 ${((1 - e) * r.dist).toFixed(2)}px`
            if (r.img) r.img.style.scale = String(+(1.08 - 0.08 * e).toFixed(4))
            if (p >= 1) {
                // clean up so hover effects and layout are untouched afterwards
                const el = r.el,
                    im = r.img
                el.classList.remove("ffm-" + r.kind)
                el.style.removeProperty("opacity")
                el.style.removeProperty("translate")
                if (im) im.style.removeProperty("scale")
                // hover transitions come back a moment later (otherwise the reset itself
                // would be animated)
                window.setTimeout(() => {
                    el.style.removeProperty("transition")
                    if (im) im.style.removeProperty("transition")
                }, 80)
                r.dur = -1
            } else keep = true
        }
        reveals.current = list.filter((r) => r.dur > 0)
        return keep
    }
    const paintScenes = useRef<() => void>(() => {})
    paintScenes.current = () => {
        const list = sceneList()
        const box = R.orbit.current
        if (box) {
            const kids = box.children
            const px =
                cardW *
                    1.3 *
                    (typeof window !== "undefined"
                        ? window.devicePixelRatio || 1
                        : 1) >
                240
                    ? 512
                    : 256
            // one card per image, never the same picture twice (spare cards are hidden)
            const n = list.length
                ? Math.min(kids.length, list.length)
                : kids.length
            for (let i = 0; i < kids.length; i++) {
                const c = kids[i] as HTMLElement
                const bg =
                    i < n && list.length
                        ? `url("${sized(list[i].src, px)}")`
                        : list.length
                          ? ""
                          : `linear-gradient(145deg, ${F[2]}, ${F[1]})`
                c.style.display = i < n ? "" : "none"
                if (c.dataset.bg !== bg) {
                    c.dataset.bg = bg
                    c.style.backgroundColor = F[1]
                    c.style.backgroundImage = bg
                }
            }
        }
        // Glow: (re)draw the visible plates (canvases are cleared when React resizes them)
        ;[R.glow.current, R.glowR.current].forEach((g) => {
            if (!g) return
            const f = list.length ? glowFlip.current : 0
            const a = g.children[f] as HTMLCanvasElement,
                b2 = g.children[1 - f] as HTMLCanvasElement
            const want = list.length ? glowCur.current : ""
            if (a && (a.dataset.src !== want || !a.dataset.ok))
                drawGlow(a, want)
            if (a) a.style.opacity = "1"
            if (b2) b2.style.opacity = "0"
        })
        kick.current()
    }
    // Glow plates are tiny canvases (48px) that the GPU stretches: soft light, no blur filter
    const glowImgs = useRef<Record<string, HTMLImageElement>>({})
    const drawGlow = (cv: HTMLCanvasElement, src: string) => {
        cv.dataset.src = src
        cv.dataset.ok = ""
        const x = cv.getContext("2d")
        if (!x) return
        const w = cv.width,
            h = cv.height
        const mask = () => {
            // soft oval edge so the light fades out instead of ending in a rectangle
            x.globalCompositeOperation = "destination-in"
            x.save()
            x.translate(w / 2, h / 2)
            x.scale(w / 2, h / 2)
            const gr = x.createRadialGradient(0, 0, 0, 0, 0, 1)
            gr.addColorStop(0, "rgba(0,0,0,1)")
            gr.addColorStop(0.5, "rgba(0,0,0,.9)")
            gr.addColorStop(1, "rgba(0,0,0,0)")
            x.fillStyle = gr
            x.fillRect(-1, -1, 2, 2)
            x.restore()
            x.globalCompositeOperation = "source-over"
            cv.dataset.ok = "1"
        }
        if (!src) {
            x.clearRect(0, 0, w, h)
            const gr = x.createLinearGradient(0, 0, w, h)
            gr.addColorStop(0, F[2])
            gr.addColorStop(0.5, F[0])
            gr.addColorStop(1, F[1])
            x.fillStyle = gr
            x.fillRect(0, 0, w, h)
            mask()
            return
        }
        const paint = (im: HTMLImageElement) => {
            if (cv.dataset.src !== src || !im.naturalWidth) return
            x.clearRect(0, 0, w, h)
            const r = Math.max(w / im.naturalWidth, h / im.naturalHeight)
            const dw = im.naturalWidth * r,
                dh = im.naturalHeight * r
            x.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh)
            try {
                // saturate + soften on the pixels (48px, costs nothing)
                const id = x.getImageData(0, 0, w, h)
                const d = id.data
                for (let i = 0; i < d.length; i += 4) {
                    const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
                    d[i] = clamp(l + (d[i] - l) * 1.7, 0, 255)
                    d[i + 1] = clamp(l + (d[i + 1] - l) * 1.7, 0, 255)
                    d[i + 2] = clamp(l + (d[i + 2] - l) * 1.7, 0, 255)
                }
                const tmp = new Uint8ClampedArray(d.length)
                for (let pass = 0; pass < 2; pass++) {
                    for (let dir = 0; dir < 2; dir++) {
                        tmp.set(d)
                        for (let yy = 0; yy < h; yy++)
                            for (let xx = 0; xx < w; xx++) {
                                let s0 = 0,
                                    s1 = 0,
                                    s2 = 0,
                                    n = 0
                                for (let o = -2; o <= 2; o++) {
                                    const px = dir
                                        ? xx
                                        : clamp(xx + o, 0, w - 1)
                                    const py = dir
                                        ? clamp(yy + o, 0, h - 1)
                                        : yy
                                    const j = (py * w + px) * 4
                                    s0 += tmp[j]
                                    s1 += tmp[j + 1]
                                    s2 += tmp[j + 2]
                                    n++
                                }
                                const j = (yy * w + xx) * 4
                                d[j] = s0 / n
                                d[j + 1] = s1 / n
                                d[j + 2] = s2 / n
                                d[j + 3] = 255
                            }
                    }
                }
                x.putImageData(id, 0, 0)
            } catch (e) {}
            mask()
        }
        const have = glowImgs.current[src]
        if (have && have.complete && have.naturalWidth) return paint(have)
        const load = (cors: boolean) => {
            const im = new Image()
            if (cors) im.crossOrigin = "anonymous"
            im.onload = () => {
                glowImgs.current[src] = im
                paint(im)
            }
            im.onerror = () => {
                if (cors) load(false)
            }
            im.src = sized(src, 96)
        }
        load(true)
    }
    // how bright the top of an image is (the status bar sits over it)
    const measureLum = (src: string) => {
        if (imgLum.current[src] !== undefined || typeof Image === "undefined")
            return
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
        im.src = sized(src, 64)
    }
    // how colourful each image is, so Glow picks images that actually glow
    const sat = useRef<Record<string, number>>({})
    const measureSat = (src: string) => {
        if (sat.current[src] !== undefined || typeof Image === "undefined")
            return
        sat.current[src] = 0.3
        const im = new Image()
        im.crossOrigin = "anonymous"
        im.onload = () => {
            try {
                const c = document.createElement("canvas")
                c.width = c.height = 24
                const x = c.getContext("2d")
                if (!x) return
                x.drawImage(im, 0, 0, 24, 24)
                const d = x.getImageData(0, 0, 24, 24).data
                let tot = 0
                for (let i = 0; i < d.length; i += 4) {
                    const mx = Math.max(d[i], d[i + 1], d[i + 2]),
                        mn = Math.min(d[i], d[i + 1], d[i + 2])
                    tot += mx ? (mx - mn) / mx : 0
                }
                sat.current[src] = tot / (d.length / 4)
            } catch (e) {}
        }
        im.src = sized(src, 64)
    }
    useEffect(() => {
        glowCur.current = ""
        paintScenes.current()
    }, [scene, imgs.length])
    useEffect(() => {
        if (isCanvas) return
        const a = window.setTimeout(() => scan.current(), 30)
        const b2 = window.setTimeout(() => scan.current(), 700)
        const c = window.setTimeout(() => scan.current(), 2000)
        return () => {
            window.clearTimeout(a)
            window.clearTimeout(b2)
            window.clearTimeout(c)
        }
    }, [motionOn, contentH, port, mode, vp.w, screenNode, isCanvas])

    // Pre-warm the other pages: the code and styles of every page the Nav links to are
    // fetched in the background, so switching pages is instant (the device stays, only
    // the screen content changes)
    useEffect(() => {
        if (isCanvas || typeof window === "undefined" || !rootRef.current)
            return
        const id = window.setTimeout(async () => {
            const root = rootRef.current
            if (!root) return
            const seen = new Set<string>([location.pathname])
            const hrefs: string[] = []
            // the Nav's links first, then everything else on the screen
            const nav = R.overlay.current
            const links = [
                ...(nav ? Array.from(nav.querySelectorAll("a[href]")) : []),
                ...Array.from(root.querySelectorAll("a[href]")),
            ]
            links.forEach((a) => {
                try {
                    const u = new URL(
                        (a as HTMLAnchorElement).href,
                        location.href
                    )
                    if (
                        u.origin !== location.origin ||
                        seen.has(u.pathname) ||
                        u.hash
                    )
                        return
                    if ((a as HTMLAnchorElement).target === "_blank") return
                    seen.add(u.pathname)
                    hrefs.push(u.pathname)
                } catch (e) {}
            })
            for (const path of hrefs.slice(0, 8)) {
                try {
                    const key = "ff-warm:" + path
                    if (window.sessionStorage.getItem(key)) continue
                    const html = await (
                        await fetch(path, { credentials: "same-origin" })
                    ).text()
                    const doc = new DOMParser().parseFromString(
                        html,
                        "text/html"
                    )
                    const urls = new Set<string>()
                    doc.querySelectorAll(
                        'link[rel="modulepreload"][href], script[type="module"][src]'
                    ).forEach((el) => {
                        const u =
                            (el as HTMLLinkElement).href ||
                            (el as HTMLScriptElement).src
                        if (u) urls.add(u)
                    })
                    urls.forEach((u) => {
                        if (
                            document.querySelector(
                                `link[rel="modulepreload"][href="${u}"]`
                            )
                        )
                            return
                        const l = document.createElement("link")
                        l.rel = "modulepreload"
                        l.href = u
                        document.head.appendChild(l)
                    })
                    window.sessionStorage.setItem(key, "1")
                } catch (e) {}
            }
        }, 2500)
        return () => window.clearTimeout(id)
    }, [isCanvas])

    // Filters: pills inside the Screen that link to the page you are on filter the
    // lists below them by their label ("All" shows everything). No setup needed:
    // make a pill, link it to this page, name it like a Category value.
    const filterVal = useRef("")
    const applyFilter = useRef<(label: string) => void>(() => {})
    applyFilter.current = (label: string) => {
        if (typeof document === "undefined") return
        const v = label.trim().toLowerCase()
        const showAll = !v || /^(all|all work|everything|show all)$/.test(v)
        filterVal.current = showAll ? "" : v
        const here = window.location.pathname.replace(/\/$/, "")
        const same = (a: HTMLAnchorElement) => {
            try {
                const u = new URL(a.href, window.location.href)
                return (
                    u.origin === window.location.origin &&
                    u.pathname.replace(/\/$/, "") === here &&
                    !u.hash
                )
            } catch (e) {
                return false
            }
        }
        const textOf = (el: Element) =>
            Array.from(
                el.querySelectorAll(
                    '[data-framer-component-type="RichTextContainer"]'
                )
            ).map((t) => (t.textContent || "").trim().toLowerCase())
        const paint = (el: HTMLElement, bg: string, col: string) => {
            el.style.backgroundColor = bg
            el.querySelectorAll("*").forEach((d) => {
                const h = d as HTMLElement
                h.style.setProperty("--framer-text-color", col)
                h.style.color = col
            })
        }
        ;[R.cL.current, R.cR.current, R.cOpen.current].forEach((root) => {
            if (!root) return
            const anchors = Array.from(
                root.querySelectorAll("a")
            ) as HTMLAnchorElement[]
            const chips = anchors.filter(same)
            if (!chips.length) return
            const labels = chips.map((c) =>
                (c.innerText || "").trim().toLowerCase()
            )
            // remember the designed "on" (first pill) and "off" (second pill) looks once
            const look = (el: HTMLElement) => {
                const t = el.querySelector("p,h1,h2,h3,h4,h5,h6,span") || el
                return {
                    bg: window.getComputedStyle(el).backgroundColor,
                    col: window.getComputedStyle(t).color,
                }
            }
            const r = root as any
            if (!r.__ffLook && chips.length > 1)
                r.__ffLook = { on: look(chips[0]), off: look(chips[1]) }
            const L2 = r.__ffLook
            chips.forEach((c, i) => {
                const active = showAll
                    ? i === 0 &&
                      /^(all|all work|everything|show all)$/.test(labels[0])
                    : labels[i] === v
                if (L2)
                    paint(
                        c,
                        active ? L2.on.bg : L2.off.bg,
                        active ? L2.on.col : L2.off.col
                    )
                c.setAttribute("aria-pressed", active ? "true" : "false")
            })
            // lists = groups of 2+ sibling links (CMS lists); an item is kept when one of
            // its texts equals the chosen label
            const lists = new Map<HTMLElement, HTMLElement[]>()
            anchors.forEach((a) => {
                if (same(a)) return
                let it: HTMLElement = a
                while (
                    it.parentElement &&
                    it.parentElement !== root &&
                    it.parentElement.children.length === 1
                )
                    it = it.parentElement
                const list = it.parentElement
                if (!list || list === root || list.children.length < 2) return
                const arr = lists.get(list) || []
                if (arr.indexOf(it) < 0) arr.push(it)
                lists.set(list, arr)
            })
            lists.forEach((items) => {
                const texts = items.map(textOf)
                const filterable = texts.some((ts) =>
                    ts.some((t) => t && labels.indexOf(t) >= 0)
                )
                if (!filterable) return
                items.forEach((it, i) => {
                    const show = showAll || texts[i].indexOf(v) >= 0
                    const wasHidden = it.style.display === "none"
                    it.style.display = show ? "" : "none"
                    if (show) {
                        it.classList.remove("ffm-show")
                        void it.offsetWidth
                        it.classList.add("ffm-show")
                    } else if (!wasHidden) it.classList.remove("ffm-show")
                })
            })
        })
        window.setTimeout(() => {
            scan.current()
            kick.current()
        }, 60)
    }
    useEffect(() => {
        const root = rootRef.current
        if (!root || isCanvas) return
        const onClick = (e: MouseEvent) => {
            const tgt = e.target as HTMLElement
            const a = (
                tgt && tgt.closest ? tgt.closest("a") : null
            ) as HTMLAnchorElement | null
            if (!a) return
            const inScreen = [R.cL.current, R.cR.current, R.cOpen.current].some(
                (r) => r && r.contains(a)
            )
            if (!inScreen) return
            try {
                const u = new URL(a.href, window.location.href)
                const here = window.location.pathname.replace(/\/$/, "")
                if (
                    u.origin !== window.location.origin ||
                    u.pathname.replace(/\/$/, "") !== here ||
                    u.hash
                )
                    return
            } catch (err) {
                return
            }
            const label = (a.innerText || "").trim()
            if (!label) return
            e.preventDefault()
            e.stopPropagation()
            applyFilter.current(label)
        }
        root.addEventListener("click", onClick, true)
        return () => root.removeEventListener("click", onClick, true)
    }, [isCanvas])

    // scroll → target, smoothed with a frame-rate independent lerp. The loop sleeps when
    // nothing moves, reads window.scrollY (no forced layout) and wakes up on scroll.
    useEffect(() => {
        if (typeof window === "undefined") return
        const reduce =
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
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
        const readTarget = () => {
            if (isCanvas) {
                // Canvas: scrub the whole timeline with the "Preview" slider
                const g = geo.current
                const span =
                    g.mode === "fold"
                        ? g.U1 + g.innerPx + g.U2 + g.U3
                        : g.innerPx
                return (clamp(preview, 0, 100) / 100) * span
            }
            return Math.max(0, window.scrollY - topRef.current)
        }
        // only animate (orbit / float) while the device is on screen
        let inView = true
        let io: IntersectionObserver | null = null
        if (typeof IntersectionObserver !== "undefined" && rootRef.current) {
            io = new IntersectionObserver((es) => {
                inView = es.some((e) => e.isIntersecting)
                if (inView) wake()
            })
            io.observe(rootRef.current)
        }
        const needsTime = () => {
            if (isCanvas || reduce || !inView) return false
            if (reveals.current.length || fadeIn.current) return true
            const g = geo.current
            if (g.scene === "orbit") return true
            return motion.float && live.current.k > 0.0005
        }
        const loop = (t: number) => {
            const target = readTarget()
            const dt = last ? Math.min(64, t - last) : 16.7
            last = t
            if (cur < 0 || reduce || isCanvas) cur = target
            else {
                const a =
                    1 -
                    Math.pow(1 - clamp(motion.smoothing, 0.02, 1), dt / 16.67)
                cur += (target - cur) * a
            }
            if (Math.abs(target - cur) < 0.1) cur = target
            live.current.cur = cur
            renderFrame.current(cur, t)
            stepReveals(t)
            if (fadeIn.current) {
                const p = clamp((t - fadeIn.current) / 420, 0, 1)
                const o = String(+easeOut(p).toFixed(3))
                ;[R.cL.current, R.cR.current, R.cOpen.current].forEach((c) => {
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
                stepReveals(performance.now() + 1e9)
                if (fadeIn.current) {
                    fadeIn.current = 0
                    ;[R.cL.current, R.cR.current, R.cOpen.current].forEach(
                        (c) => {
                            if (c) c.style.opacity = "1"
                        }
                    )
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
    }, [isCanvas, preview, motion.smoothing, motion.float])

    // [Z8] in-screen navigation: the open screen's content scrolls with the page, so a link inside it
    // cannot use #anchors. Dispatch `window.dispatchEvent(new CustomEvent("ff:scrollto", { detail: { y } }))`
    // with y = the target's offset from the top of the screen content (screen px); this scrolls the
    // page to the spot where the phone is open and that part of the screen is at the top.
    useEffect(() => {
        if (isCanvas || typeof window === "undefined") return
        const onGo = (e: Event) => {
            const y = Number((e as CustomEvent).detail?.y) || 0
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
    }, [isCanvas])

    // [Z8] pointer tilt: the whole device turns a few degrees toward the cursor and the body's
    // side edge (--ff-ex / --ff-ey) follows, so it reads as a solid object, not a flat picture.
    // Mouse/trackpad only; off for reduced motion and on touch screens.
    useEffect(() => {
        if (isCanvas || typeof window === "undefined" || !window.matchMedia) return
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
        const onMove = (e: PointerEvent) => {
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
    }, [isCanvas])

    // page change: the device stays where it is, only the screen content fades in (driven
    // from the loop, so nothing is animated by the compositor)
    const fadeIn = useRef(0)
    const adopted = useRef(false)
    // ---------- opening animation: a seam of light, the page parts along the fold,
    // your name rises, then the phone lifts into place and the controls settle.
    // Pure 2D (translate / scale / rotate / opacity) stepped from rAF; everything is
    // reset to the normal state at the end.
    const playIntro = () => {
        const cur = R.iCur.current,
            a = R.iA.current,
            b = R.iB.current,
            seam = R.iSeam.current
        const dev = R.iDev.current,
            nm = R.iNames.current
        if (!cur || !a || !b || !seam || !dev) return
        cur.style.animation = "none"
        const sp = 1 / Math.max(0.4, Math.min(2, introCfg.speed || 1))
        const D = (ms: number) => ms * sp
        const cl = (v: number) => Math.min(1, Math.max(0, v))
        const o3 = (k: number) => 1 - Math.pow(1 - k, 3)
        const o4 = (k: number) => 1 - Math.pow(1 - k, 4)
        const o5 = (k: number) => 1 - Math.pow(1 - k, 5)
        const dots = () =>
            R.stage.current
                ? (R.stage.current.querySelector(
                      "[data-ff-dots]"
                  ) as HTMLElement | null)
                : null
        const head = () =>
            document.querySelector("[data-ff-switcher]") as HTMLElement | null
        let done = false
        // [Z8] held = the site loader drew the seam already: start with it full
        let held = false
        // no name beside the phone (inner pages): the phone comes in sooner
        const early = nm && nm.textContent && nm.textContent.trim() ? 0 : 280
        const set = (t: number) => {
            const k = (x: number, y: number) => cl((t - D(x)) / (D(y) - D(x)))
            const P = geo.current.port
            const vh = window.innerHeight,
                vw = window.innerWidth
            const ks = held ? 1 : o3(k(0, 560))
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
            if (nm) {
                const kn = o4(k(560, 1500))
                nm.style.opacity = String(+kn.toFixed(3))
                nm.style.translate = `0 ${((1 - kn) * 56).toFixed(1)}px`
            }
            const kd = k(820 - early, 2000 - early),
                e = o5(kd)
            dev.style.opacity = String(+cl(kd * 3).toFixed(3))
            dev.style.transform = `translateY(${((1 - e) * vh * 0.5).toFixed(1)}px) rotate(${((1 - e) * -5).toFixed(3)}deg) scale(${(0.82 + 0.18 * e).toFixed(4)})`
            const ku = o3(k(1600, 2250))
            ;[dots(), head()].forEach((el) => {
                if (!el) return
                el.style.opacity = String(+ku.toFixed(3))
                el.style.translate = `0 ${((1 - ku) * 14).toFixed(1)}px`
            })
        }
        const end = () => {
            if (done) return
            done = true
            cur.style.display = "none"
            dev.style.transform = ""
            dev.style.opacity = ""
            if (nm) {
                nm.style.opacity = ""
                nm.style.translate = ""
            }
            ;[dots(), head()].forEach((el) => {
                if (!el) return
                el.style.opacity = ""
                el.style.translate = ""
            })
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
        const go = (skip: number) => {
            if (done) return
            const t0 = performance.now() - skip
            set(skip)
            const step = (now: number) => {
                if (done) return
                const t = now - t0
                set(t)
                if (t < total) window.requestAnimationFrame(step)
                else end()
            }
            window.requestAnimationFrame(step)
            window.setTimeout(end, total + 1500)
        }
        // [Z8] the site loader can hold the closed curtain (window.__ffIntroHold, a Promise) and
        // hands over its progress line as the seam; capped at 10s so the page can never stay covered
        const hold = (window as any).__ffIntroHold
        if (hold && typeof hold.then === "function") {
            Promise.race([hold, new Promise((r) => window.setTimeout(r, 10000))]).then(() => {
                held = true
                go(D(420))
            })
        } else go(0)
    }
    useIsoLayoutEffect(() => {
        if (isCanvas || typeof window === "undefined") return
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
        {
            const reduced =
                window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
            if (ffLoad.intro === null) {
                const run =
                    introLive &&
                    !seen &&
                    !document.getElementById(SNAP_ID) &&
                    document.visibilityState === "visible" &&
                    window.scrollY < 40 &&
                    !reduced
                ffLoad.intro = run
                if (run) playIntro()
            }
            if (!ffLoad.intro && R.iCur.current) R.iCur.current.style.display = "none"
        }
        if (document.getElementById(SNAP_ID)) {
            // the previous page left a still copy of itself on top: this page draws at full
            // opacity underneath and the copy fades out once the screen is ready
            adopted.current = true
            return
        }
        if (seen) {
            // before the first paint: content hidden, then the loop fades it in
            ;[R.cL.current, R.cR.current, R.cOpen.current].forEach((c) => {
                if (c) c.style.opacity = "0"
            })
            fadeIn.current = performance.now()
            kick.current()
        }
    }, [isCanvas])
    // leaving the page: keep a still copy of the stage on screen for the next page
    useIsoLayoutEffect(() => {
        if (isCanvas || typeof window === "undefined") return
        return () => {
            if (R.stage.current) takeSnapshot(R.stage.current)
        }
    }, [isCanvas])
    useEffect(() => {
        if (!adopted.current || isCanvas || typeof window === "undefined")
            return
        adopted.current = false
        const t0 = Date.now()
        let id = 0
        const check = () => {
            const main = R.cOpen.current || R.cR.current || R.cL.current
            let ready = true
            if (main) {
                const top = main.getBoundingClientRect().top
                main.querySelectorAll("img").forEach((im) => {
                    const i = im as HTMLImageElement
                    if (
                        i.getBoundingClientRect().top - top < G.H * 1.2 &&
                        !(i.complete && i.naturalWidth)
                    )
                        ready = false
                })
            }
            if (ready || Date.now() - t0 > 1200) {
                kick.current()
                if (document.visibilityState === "hidden") releaseSnapshot(0)
                else {
                    // two frames so this page has really painted underneath
                    window.requestAnimationFrame(() =>
                        window.requestAnimationFrame(() => releaseSnapshot(360))
                    )
                    window.setTimeout(() => releaseSnapshot(360), 500)
                }
            } else id = window.setTimeout(check, 40)
        }
        id = window.setTimeout(check, 60)
        return () => window.clearTimeout(id)
    }, [isCanvas])

    // live clock for the status bar
    const [clock, setClock] = useState(status.time)
    useEffect(() => {
        if (!status.live || typeof window === "undefined" || isCanvas) {
            setClock(status.time)
            return
        }
        // [Z8] live time is India time, matching the site's IST clock (was the visitor's local time)
        const tick = () => {
            startTransition(() => setClock(indiaHHMM()))
        }
        tick()
        const id = window.setInterval(tick, 15000)
        return () => window.clearInterval(id)
    }, [status.live, status.time, isCanvas])

    // ---------------------------------------------------------------- styles
    const T = G.T
    const Ri = G.R - b
    const slabBg = `linear-gradient(145deg, ${F[2]} 0%, ${F[0]} 30%, ${F[1]} 55%, ${F[0]} 75%, ${F[3]} 100%)`
    const slabShadow =
        "inset 0 1px 1px rgba(255,255,255,.82), inset 0 -1px 1px rgba(0,0,0,.3), inset 0 0 0 1px rgba(255,255,255,.25)"
    const abs: React.CSSProperties = { position: "absolute" }
    const fill: React.CSSProperties = { position: "absolute", inset: 0 }

    // [Z8] real body thickness: a strip on the outer edge of a turning half, folded back 90deg in 3D,
    // so the phone's metal side is visible while it opens and closes
    const edgeBg = `linear-gradient(${land ? "90deg" : "180deg"}, ${F[3]}, ${F[1]} 28%, ${F[2]} 52%, ${F[1]} 78%, ${F[3]})`
    const edgeStrip = (which: "leaf" | "cover") => {
        const inset = Ro * 0.55
        const base: React.CSSProperties = {
            ...abs,
            background: edgeBg,
            borderRadius: T / 2,
            pointerEvents: "none",
        }
        if (land)
            return which === "leaf" ? (
                <div aria-hidden style={{ ...base, left: 0, top: inset, bottom: inset, width: T, transformOrigin: "0% 50%", transform: "rotateY(90deg)" }} />
            ) : (
                <div aria-hidden style={{ ...base, right: 0, top: inset, bottom: inset, width: T, transformOrigin: "100% 50%", transform: "rotateY(-90deg)" }} />
            )
        // Flip: the strip starts in the frame colour where it joins the body and darkens toward the
        // back, so it reads as one piece of metal (a dark joint made it look like a separate rod)
        const pIn = Ro * 0.3
        const pBg = (dir: string) => `linear-gradient(${dir}, ${F[1]}, ${F[1]} 18%, ${F[2]} 55%, ${F[3]})`
        return which === "leaf" ? (
            <div aria-hidden data-ffedge="" style={{ ...base, background: pBg("180deg"), borderRadius: `0 0 ${T / 2}px ${T / 2}px`, top: 0, left: pIn, right: pIn, height: T, transformOrigin: "50% 0%", transform: "rotateX(-90deg)" }} />
        ) : (
            <div aria-hidden data-ffedge="" style={{ ...base, background: pBg("0deg"), borderRadius: `${T / 2}px ${T / 2}px 0 0`, bottom: 0, left: pIn, right: pIn, height: T, transformOrigin: "50% 100%", transform: "rotateX(90deg)" }} />
        )
    }

    // [Z8] cameras. Fold 8: punch-hole on the cover, faint under-display camera on the inner screen.
    // Flip 8: two large lens rings on the FlexWindow (cover), punch-hole on the inner screen.
    const holeStyle = (d: number, top: number, faint = false): React.CSSProperties => ({
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
    const innerCam = (kind: "udc" | "hole") => (
        <div aria-hidden style={kind === "udc" ? holeStyle(26, 26, true) : holeStyle(20, 14)} />
    )
    const lens = (d: number): React.CSSProperties => ({
        width: d,
        height: d,
        flex: "none",
        borderRadius: "50%",
        background: `radial-gradient(circle at 40% 36%, #3c3f4d 0%, #11131a 34%, #000 56%, #000 61%, ${F[3]} 64%, ${F[2]} 73%, ${F[1]} 87%, ${F[3]} 100%)`,
        boxShadow: "0 3px 8px rgba(0,0,0,.45), inset 0 0 0 1px rgba(0,0,0,.4)",
    })
    // Flip: no cameras (removed at the user's request)
    const coverCams = land ? <div aria-hidden style={holeStyle(24, 24)} /> : null
    // status bar colour: fixed, or "auto" (reads the screen under it and picks dark/light)
    const tint =
        status.tone === "dark"
            ? "#111"
            : status.tone === "light"
              ? "#fff"
              : "#fff"
    const autoTint = status.tone !== "dark" && status.tone !== "light"

    const statusBar = (part: "all" | "left" | "right") =>
        status.show ? (
            <div
                data-ffsb={autoTint ? part : undefined}
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
                    color: tint,
                    letterSpacing: "-.01em",
                    textShadow:
                        status.tone === "light"
                            ? "0 1px 6px rgba(0,0,0,.25)"
                            : "none",
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
        ) : null

    // Realistic crease: soft depression + highlight, blends with anything underneath.
    const crease = (side: "left" | "right" | "top" | "bottom" | "center") => {
        // barely-there, like a real foldable in daylight: a soft dip with a faint sheen
        // a wide, very soft dip only (no line, no highlight): you sense the fold, you don't see a seam
        const w = 72
        const grad = (dir: string) =>
            `linear-gradient(${dir}, rgba(0,0,0,0) 0%, rgba(0,0,0,.008) 35%, rgba(0,0,0,.016) 50%, rgba(0,0,0,.008) 65%, rgba(0,0,0,0) 100%)`
        const base: React.CSSProperties = {
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
    const sheen = (part?: "L" | "R") => (
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

    // Screen content copies
    const contentCopy = (which: "L" | "R" | "open") => {
        const ref = which === "L" ? R.cL : which === "R" ? R.cR : R.cOpen
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
                    ref={
                        which === (mode === "fold" ? "R" : "open")
                            ? measureRef
                            : undefined
                    }
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
    const leafBox: React.CSSProperties = land
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
    const rightBox: React.CSSProperties = land
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
    const insets = (
        v: number,
        hinge: "L" | "R" | "T" | "B" | "none",
        bleed = 0
    ) => ({
        top: hinge === "T" ? -bleed : v,
        bottom: hinge === "B" ? -bleed : v,
        left: hinge === "L" ? -bleed : v,
        right: hinge === "R" ? -bleed : v,
    })
    const hingeOfLeaf = land ? "R" : "B"
    const hingeOfRight = land ? "L" : "T"
    const cornerT = "border-radius .35s cubic-bezier(.2,.7,.2,1)"
    const body = (
        corners: string,
        hinge: "L" | "R" | "T" | "B" | "none",
        children: React.ReactNode,
        refs?: [any, any, any],
        extra?: React.ReactNode,
        bleed = 0
    ) => (
        <>
            <div
                ref={refs && refs[0]}
                style={{
                    ...abs,
                    ...insets(0, hinge, bleed),
                    borderRadius: corners,
                    background: slabBg,
                    boxShadow: slabShadow,
                    transition: refs ? cornerT : undefined,
                }}
            />
            <div
                ref={refs && refs[1]}
                style={{
                    ...abs,
                    ...insets(G.f, hinge, bleed),
                    borderRadius: inner(corners, G.f),
                    background: "#050505",
                    transition: refs ? cornerT : undefined,
                }}
            />
            <div
                ref={refs && refs[2]}
                style={{
                    ...abs,
                    ...insets(b, hinge, bleed),
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
    const shadeGrad = (dir: "front" | "back" | "right") => {
        const d = land ? "90deg" : "180deg"
        if (dir === "front")
            return `linear-gradient(${d}, rgba(0,0,0,.05) 0%, rgba(0,0,0,.55) 100%)`
        if (dir === "back")
            return `linear-gradient(${d}, rgba(0,0,0,.5) 0%, rgba(0,0,0,.05) 100%)`
        return `linear-gradient(${d}, rgba(0,0,0,.6) 0%, rgba(0,0,0,0) 70%)`
    }
    // Side buttons (volume + power) on the outer frame
    const sideButtons = (
        <>
            {[
                [0.17, 0.1],
                [0.31, 0.06],
            ].map(([top, h], i) => (
                <div
                    key={i}
                    style={{
                        ...abs,
                        right: -3,
                        width: 5,
                        borderRadius: 3,
                        top: land
                            ? `${top * 100}%`
                            : `${(top * 0.8 + 0.05) * 100}%`,
                        height: `${h * (land ? 100 : 160)}%`,
                        background: `linear-gradient(90deg, ${F[3]}, ${F[2]} 45%, ${F[1]})`,
                        boxShadow: "0 0 0 .5px rgba(0,0,0,.2)",
                    }}
                />
            ))}
        </>
    )

    // [Z8] the phone's body seen from the side: two plates hidden right behind the halves. Their stacked
    // shadows form a solid metal edge under (and, with the tilt, beside) the device.
    const sideShadow =
        Array.from({ length: 7 }, (_, i) => {
            const fr = ((i + 1) / 7).toFixed(3)
            return `calc(var(--ff-ex, 0) * ${fr}px) calc(var(--ff-ey, ${EDGE}) * ${fr}px) 0 0 ${mixHex(F[1], F[3], (i + 1) / 7)}`
        }).join(", ") + `, calc(var(--ff-ex, 0) * 1px) calc(var(--ff-ey, ${EDGE}) * 1px + 1.5px) 1px 0 rgba(0,0,0,.22)`
    const bodySide = (
        <>
            <div ref={R.plateL} aria-hidden style={{ ...leafBox, borderRadius: cLeaf, background: F[1], boxShadow: sideShadow, transition: "opacity .25s ease", pointerEvents: "none" }} />
            <div ref={R.plateR} aria-hidden style={{ ...rightBox, borderRadius: cRight, background: F[1], boxShadow: sideShadow, pointerEvents: "none" }} />
        </>
    )

    const foldMode = mode === "fold"

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
                        const tg = e.target as HTMLElement
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
            }}
        >
            {floorShadows}
            {bodySide /* [Z8] */}
            {foldMode ? (
                <>
                    {/* right / bottom half: never moves */}
                    {/* [Z8] isolate: keeps this half's z-index 9 shading inside it, so it can't paint over the cover's edge strip */}
                    <div ref={R.rightH} style={{ ...rightBox, isolation: "isolate" }}>
                        {body(
                            cRight,
                            hingeOfRight,
                            <>
                                {contentCopy("R")}
                                {land && statusBar("right")}
                                {land && innerCam("udc") /* [Z8] Fold 8 under-display camera */}
                                {crease(land ? "right" : "bottom")}
                                {sheen("R")}
                            </>,
                            [R.rBody, R.rGlass, R.rScreen],
                            <>
                                {sideButtons}
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
                    <div ref={R.leaf} style={{ ...leafBox, transformStyle: "preserve-3d" /* [Z8] */ }}>
                        {edgeStrip("leaf") /* [Z8] */}
                        {body(
                            cLeaf,
                            hingeOfLeaf,
                            <>
                                {contentCopy("L")}
                                {statusBar(land ? "left" : "all")}
                                {crease(land ? "left" : "top")}
                                {sheen("L")}
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
                            />,
                            hingeBleed
                        )}
                    </div>
                    {/* cover: the outside of the left half, lies on the right half when closed */}
                    <div
                        ref={R.cover}
                        style={{ ...rightBox, visibility: "hidden", transformStyle: "preserve-3d" /* [Z8] */ }}
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
                        <div
                            style={{
                                ...abs,
                                inset: G.f,
                                borderRadius: Ro - G.f,
                                background: "#050505",
                            }}
                        />
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
                </>
            ) : (
                /* Open mode: one continuous display */
                <div ref={R.openBlk} style={{ ...fill }}>
                    {body(
                        cAll,
                        "none",
                        <>
                            {contentCopy("open")}
                            {crease("center")}
                            {sheen()}
                        </>,
                        undefined,
                        sideButtons
                    )}
                </div>
            )}

            {/* nav + status on top of the open display */}
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
                    opacity: foldMode ? 0 : 1,
                    zIndex: 10,
                }}
            >
                {!foldMode && statusBar("all")}
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

    // ---------------------------------------------------------------- scenes
    // Basic (key "split"): one soft tint of the frame colour that follows the finish (+ your names, if connected)
    const tone = props.basicTone || "tint"
    const splitA =
        tone === "white"
            ? "#FFFFFF"
            : mixHex(F[0], "#FFFFFF", tone === "two" ? 0.84 : 0.8)
    const splitB = tone === "two" ? mixHex(F[0], "#FFFFFF", 0.6) : splitA
    // the intro curtain matches what is behind it (Basic tint, or the page colour)
    const curtainBg =
        introCfg.color || (scene === "split" ? splitA : pageBg || "#FFFFFF")
    const splitLayer =
        scene === "split" ? (
            <div
                style={{
                    ...fill,
                    pointerEvents: "none",
                    background: port
                        ? `linear-gradient(180deg, ${splitA} 0%, ${splitA} ${(cy / stageH) * 100}%, ${splitB} ${(cy / stageH) * 100}%, ${splitB} 100%)`
                        : `linear-gradient(90deg, ${splitA} 0%, ${splitA} 50%, ${splitB} 50%, ${splitB} 100%)`,
                    transition: "background .6s ease",
                }}
            />
        ) : null
    const namesLayer =
        scene === "split" && (nameL || nameR) ? (
            <div style={{ ...fill, pointerEvents: "none", overflow: "hidden" }}>
                <div
                    ref={R.nmL}
                    style={{
                        ...abs,
                        left: 0,
                        top: 0,
                    }}
                >
                    <div
                        ref={nlRef}
                        style={{
                            width:
                                nameSize.lw > 1 ? nameSize.lw : "max-content",
                            height: nameSize.lh > 1 ? nameSize.lh : "auto",
                        }}
                    >
                        <Slot node={nameL} width="max-content" />
                    </div>
                </div>
                <div
                    ref={R.nmR}
                    style={{
                        ...abs,
                        left: 0,
                        top: 0,
                    }}
                >
                    <div
                        ref={nrRef}
                        style={{
                            width:
                                nameSize.rw > 1 ? nameSize.rw : "max-content",
                            height: nameSize.rh > 1 ? nameSize.rh : "auto",
                        }}
                    >
                        <Slot node={nameR} width="max-content" />
                    </div>
                </div>
            </div>
        ) : null

    // Glow: the image on screen, blown up into soft light behind the phone
    const glowPad = clamp(Math.min(G.W, G.H) * s * 0.32, 60, 170)
    const glowW = G.W * s * 1.02 + glowPad * 2,
        glowH = G.H * s * 1.02 + glowPad * 2
    const glowPlates = (bh: number) =>
        [0, 1].map((i) => (
            <canvas
                key={i}
                width={48}
                height={bh}
                style={{
                    ...fill,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    transition: "opacity .6s ease",
                }}
            />
        ))
    const glowLayer =
        scene === "glow" ? (
            <div style={{ ...fill, pointerEvents: "none", overflow: "hidden" }}>
                <div
                    ref={R.glow}
                    style={{
                        ...abs,
                        left: "50%",
                        top: cy,
                        width: glowW,
                        height: glowH,
                    }}
                >
                    {glowPlates(
                        clamp(Math.round((48 * glowH) / glowW), 16, 96)
                    )}
                </div>
                <div
                    ref={R.glowR}
                    style={{
                        ...abs,
                        left: "50%",
                        top: cy + G.H * s * 0.5,
                        width: G.W * s * 0.9 + glowPad,
                        height: G.H * s * 0.3 + glowPad,
                    }}
                >
                    {glowPlates(
                        clamp(
                            Math.round(
                                (48 * (G.H * s * 0.3 + glowPad)) /
                                    (G.W * s * 0.9 + glowPad)
                            ),
                            12,
                            96
                        )
                    )}
                </div>
            </div>
        ) : null

    // Orbit: cards with your images circling the phone
    const cardW = Math.round(
        Math.min(G.H * s, G.W * s * 1.2) * (port ? 0.17 : 0.15)
    )
    const orbitLayer =
        scene === "orbit" ? (
            <div
                ref={R.orbit}
                style={{ ...fill, pointerEvents: "none", overflow: "hidden" }}
            >
                {Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        data-orb={i}
                        style={{
                            ...abs,
                            left: 0,
                            top: 0,
                            width: cardW,
                            height: Math.round(cardW * 1.28),
                            borderRadius: 12,
                            opacity: 0,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            boxShadow:
                                "0 16px 30px -16px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.05)",
                        }}
                    />
                ))}
            </div>
        ) : null

    // ---------------------------------------------------------------- live switcher
    const compact = vp.w < 560
    const glass: React.CSSProperties = {
        display: "flex",
        borderRadius: 999,
        background: "rgba(255,255,255,.92)",
        boxShadow:
            "inset 0 0 0 1px rgba(0,0,0,.06), 0 10px 30px -12px rgba(0,0,0,.25)",
    }
    // Split / Glow / Orbit: in the site header (top right) or under the device
    const scenesInHeader = (switcher.scenesAt || "header") === "header"
    const scenePill = (inHeader: boolean) => (
        <div
            role="radiogroup"
            aria-label="Background"
            style={{
                ...glass,
                gap: 2,
                padding: inHeader ? 3 : 4,
                font: "500 12px/1 var(--font)" /* [Z8] site font (was Inter, system-ui) */,
                color: "#111",
            }}
        >
            {SCENES.map((sc) => (
                <button
                    key={sc.key}
                    role="radio"
                    aria-checked={scene === sc.key}
                    onClick={() => choose({ scene: sc.key })}
                    style={{
                        all: "unset",
                        cursor: "pointer",
                        padding: inHeader
                            ? compact
                                ? "7px 10px"
                                : "8px 13px"
                            : compact
                              ? "8px 10px"
                              : "9px 13px",
                        borderRadius: 999,
                        background: scene === sc.key ? "#111" : "transparent",
                        color: scene === sc.key ? "#fff" : "#111",
                        transition: "background .3s, color .3s",
                    }}
                >
                    {sc.label}
                </button>
            ))}
        </div>
    )
    // header placement lives on the page itself (above Framer's fixed header), not in the stage
    const [portalOn, setPortalOn] = useState(false)
    useEffect(() => {
        if (!isCanvas && typeof document !== "undefined") setPortalOn(true)
    }, [isCanvas])
    const hTop = switcher.top ?? 15
    const hRight = switcher.right ?? 28
    const headerSwitcher =
        switcher.show && scenesInHeader ? (
            isCanvas ? (
                <div style={{ ...abs, top: hTop, right: hRight, zIndex: 30 }}>
                    {scenePill(true)}
                </div>
            ) : portalOn ? (
                createPortal(
                    <div
                        data-ff-switcher=""
                        style={{
                            position: "fixed",
                            top: hTop,
                            right: hRight,
                            zIndex: 60,
                            pointerEvents: "auto",
                        }}
                    >
                        {scenePill(true)}
                    </div>,
                    document.body
                )
            ) : null
        ) : null
    const dotsLeft = compact && scenesInHeader
    const switcherUI = switcher.show ? (
        <div
            data-ff-dots=""
            style={{
                ...abs,
                left: dotsLeft ? (switcher.right ?? 28) : "50%",
                bottom: switcher.bottom,
                transform: dotsLeft ? "none" : "translateX(-50%)",
                display: "flex",
                gap: 8,
                alignItems: "center",
                zIndex: 20,
                pointerEvents: "auto",
                font: "500 12px/1 var(--font)" /* [Z8] site font (was Inter, system-ui) */,
                color: "#111",
            }}
        >
            {!scenesInHeader && scenePill(false)}
            <div
                role="radiogroup"
                aria-label="Finish"
                style={{ ...glass, gap: 8, padding: "8px 10px" }}
            >
                {FINISH_KEYS.map((fk) => (
                    <button
                        key={fk}
                        role="radio"
                        aria-checked={pick.finish === fk}
                        aria-label={FINISHES[fk].label}
                        title={FINISHES[fk].label}
                        onClick={() => choose({ finish: fk })}
                        style={{
                            all: "unset",
                            cursor: "pointer",
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${FINISHES[fk].c[2]}, ${FINISHES[fk].c[1]})`,
                            boxShadow:
                                pick.finish === fk
                                    ? "0 0 0 2px #fff, 0 0 0 3.5px #111"
                                    : "inset 0 0 0 1px rgba(0,0,0,.15)",
                            transition: "box-shadow .3s",
                        }}
                    />
                ))}
            </div>
        </div>
    ) : null

    // ---------------------------------------------------------------- render
    return (
        <div
            ref={rootRef}
            className={
                (motionOn ? "ffm-on" : "") +
                (mo.hover && !isCanvas ? " ffm-hover" : "") +
                (motion.glass ? "" : " ffm-lite")
            }
            style={{
                ...props.style,
                position: "relative",
                width: "100%",
                height: totalH,
                ["--ffdur" as any]: mo.duration + "s",
                ["--ffd" as any]: mo.distance + "px",
            }}
        >
            {(motionOn || mo.hover) && !isCanvas && <style>{MOTION_CSS}</style>}
            {!motion.glass && <style>{LITE_CSS}</style>}
            <div
                ref={R.stage}
                style={{
                    position: isCanvas ? "relative" : "sticky",
                    top: 0,
                    width: "100%",
                    height: stageH,
                    overflow: "hidden",
                    background: pageBg || undefined,
                }}
            >
                <div style={fill}>
                    {splitLayer}
                    {props.backdrop /* [BG] your own layer behind the phone (above the Basic tint) */}
                    <div
                        ref={R.iNames}
                        style={{ ...fill, pointerEvents: "none" }}
                    >
                        {namesLayer}
                    </div>
                    {glowLayer}
                    {orbitLayer}
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
                                ref={R.wB}
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
                {headerSwitcher}
                {introLive && (
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
                                background: introCfg.line,
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
                )}
            </div>
        </div>
    )
}

FoldfolioDevice.displayName = "Foldfolio Device"

// ---------------------------------------------------------------- property controls

addPropertyControls(FoldfolioDevice, {
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["fold", "open"],
        optionTitles: ["Fold (Home)", "Open (Pages)"],
        defaultValue: "open",
        displaySegmentedControl: true,
    },
    screen: { type: ControlType.Slot, title: "Screen", maxCount: 1 },
    screenPortrait: {
        type: ControlType.Slot,
        title: "Screen Phone",
        maxCount: 1,
    },
    nav: { type: ControlType.Slot, title: "Nav", maxCount: 1 },
    navPortrait: { type: ControlType.Slot, title: "Nav Phone", maxCount: 1 },
    cover: {
        type: ControlType.Slot,
        title: "Cover",
        maxCount: 1,
        hidden: (p: any) => p.mode !== "fold",
    },
    coverPortrait: {
        type: ControlType.Slot,
        title: "Cover Phone",
        maxCount: 1,
        hidden: (p: any) => p.mode !== "fold",
    },
    call: {
        type: ControlType.Slot,
        title: "Call",
        maxCount: 1,
        hidden: (p: any) => p.mode !== "fold",
    },
    callPortrait: {
        type: ControlType.Slot,
        title: "Call Phone",
        maxCount: 1,
        hidden: (p: any) => p.mode !== "fold",
    },
    scene: {
        type: ControlType.Enum,
        title: "Background",
        options: ["split", "glow", "orbit", "none"],
        optionTitles: ["Basic", "Glow", "Orbit", "None"],
        defaultValue: "split",
    },
    basicTone: {
        type: ControlType.Enum,
        title: "Basic Tone",
        options: ["tint", "white", "two"],
        optionTitles: ["Frame colour", "White", "Two-tone"],
        defaultValue: "tint",
        description:
            "Backdrop of the Basic scene: a soft tint that follows the frame colour, plain white, or two tones split at the hinge.",
        hidden: (p: any) => p.scene !== "split",
    },
    nameLeft: { type: ControlType.Slot, title: "Name Left", maxCount: 1 },
    nameRight: { type: ControlType.Slot, title: "Name Right", maxCount: 1 },
    sceneImages: {
        type: ControlType.Array,
        title: "Scene Images",
        control: { type: ControlType.ResponsiveImage },
        maxCount: 12,
    },
    finish: {
        type: ControlType.Enum,
        title: "Finish",
        options: ["titanium", "graphite", "coral", "sage", "custom"],
        optionTitles: ["Titanium", "Graphite", "Coral", "Sage", "Custom"],
        defaultValue: "titanium",
    },
    customFinish: {
        type: ControlType.Color,
        title: "Custom",
        defaultValue: "#C9D3E0",
        hidden: (p: any) => p.finish !== "custom",
    },
    screenColor: {
        type: ControlType.Color,
        title: "Screen",
        defaultValue: "#0B0B0B",
    },
    switcher: {
        type: ControlType.Object,
        title: "Switcher",
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: true,
            },
            scenesAt: {
                type: ControlType.Enum,
                title: "Scenes",
                options: ["header", "bottom"],
                optionTitles: ["Header", "Bottom"],
                defaultValue: "header",
                displaySegmentedControl: true,
                description:
                    "Basic / Glow / Orbit: top right of the page (over your header) or under the device next to the colours.",
            },
            top: {
                type: ControlType.Number,
                title: "Header Top",
                defaultValue: 15,
                min: 0,
                max: 80,
                unit: "px",
                hidden: (p: any) => p.scenesAt === "bottom",
            },
            right: {
                type: ControlType.Number,
                title: "Header Right",
                defaultValue: 28,
                min: 0,
                max: 120,
                unit: "px",
                hidden: (p: any) => p.scenesAt === "bottom",
            },
            bottom: {
                type: ControlType.Number,
                title: "Bottom",
                defaultValue: 18,
                min: 0,
                max: 120,
                unit: "px",
            },
        },
    },
    status: {
        type: ControlType.Object,
        title: "Status Bar",
        controls: {
            show: {
                type: ControlType.Boolean,
                title: "Show",
                defaultValue: true,
            },
            time: {
                type: ControlType.String,
                title: "Time",
                defaultValue: "09:41",
            },
            live: {
                type: ControlType.Boolean,
                title: "Live Time",
                defaultValue: false,
            },
            tone: {
                type: ControlType.Enum,
                title: "Tint",
                options: ["auto", "light", "dark"],
                optionTitles: ["Auto", "Light", "Dark"],
                defaultValue: "auto",
                displaySegmentedControl: true,
            },
        },
    },
    layout: {
        type: ControlType.Object,
        title: "Layout",
        controls: {
            orientation: {
                type: ControlType.Enum,
                title: "Orientation",
                options: ["auto", "landscape", "portrait"],
                optionTitles: ["Auto", "Landscape", "Portrait"],
                defaultValue: "auto",
            },
            portraitBelow: {
                type: ControlType.Number,
                title: "Phone Below",
                defaultValue: 700,
                min: 320,
                max: 1200,
                unit: "px",
            },
            top: {
                type: ControlType.Number,
                title: "Top Space",
                defaultValue: 72,
                min: 0,
                max: 200,
                unit: "px",
            },
            bottom: {
                type: ControlType.Number,
                title: "Bottom Space",
                defaultValue: 32,
                min: 0,
                max: 200,
                unit: "px",
            },
            maxScale: {
                type: ControlType.Number,
                title: "Max Scale",
                defaultValue: 1.3,
                min: 0.5,
                max: 2,
                step: 0.05,
            },
        },
    },
    motion: {
        type: ControlType.Object,
        title: "Motion",
        controls: {
            openLength: {
                type: ControlType.Number,
                title: "Open",
                defaultValue: 1.15,
                min: 0.3,
                max: 3,
                step: 0.05,
                unit: "vh",
            },
            closeLength: {
                type: ControlType.Number,
                title: "Close",
                defaultValue: 1.1,
                min: 0.3,
                max: 3,
                step: 0.05,
                unit: "vh",
            },
            holdLength: {
                type: ControlType.Number,
                title: "Hold",
                defaultValue: 0.4,
                min: 0,
                max: 2,
                step: 0.05,
                unit: "vh",
            },
            smoothing: {
                type: ControlType.Number,
                title: "Smoothing",
                defaultValue: 0.12,
                min: 0.02,
                max: 1,
                step: 0.01,
            },
            float: {
                type: ControlType.Boolean,
                title: "Idle Float",
                defaultValue: true,
            },
            glass: {
                type: ControlType.Boolean,
                title: "Glass Blur",
                description:
                    "Allow backdrop blur (frosted glass) inside the device. Off keeps scrolling smooth on weaker computers.",
                defaultValue: false,
            },
        },
    },
    screenMotion: {
        type: ControlType.Object,
        title: "Screen Motion",
        description:
            "Text, heading, image and count-up animations inside the screen. Name a frame Count… to count its number up; Button… lifts, Row… slides, Card… rises on hover.",
        controls: {
            on: {
                type: ControlType.Boolean,
                title: "Reveal",
                defaultValue: true,
            },
            headlines: {
                type: ControlType.Boolean,
                title: "Headings",
                defaultValue: true,
            },
            images: {
                type: ControlType.Boolean,
                title: "Images",
                defaultValue: true,
            },
            counters: {
                type: ControlType.Boolean,
                title: "Count Up",
                defaultValue: true,
            },
            hover: {
                type: ControlType.Boolean,
                title: "Hover",
                defaultValue: true,
            },
            duration: {
                type: ControlType.Number,
                title: "Duration",
                defaultValue: 1,
                min: 0.3,
                max: 3,
                step: 0.05,
                unit: "s",
            },
            distance: {
                type: ControlType.Number,
                title: "Distance",
                defaultValue: 26,
                min: 0,
                max: 120,
                unit: "px",
            },
            stagger: {
                type: ControlType.Number,
                title: "Stagger",
                defaultValue: 0.06,
                min: 0,
                max: 0.3,
                step: 0.01,
                unit: "s",
            },
        },
    },
    intro: {
        type: ControlType.Object,
        title: "Intro",
        description:
            "Opening animation on the first page of a visit: the page parts along the fold, your name rises, then the phone lifts in.",
        controls: {
            on: {
                type: ControlType.Boolean,
                title: "Play",
                defaultValue: true,
            },
            color: {
                type: ControlType.Color,
                title: "Curtain",
                optional: true,
                description: "Empty = matches the backdrop.",
            },
            line: {
                type: ControlType.Color,
                title: "Seam",
                defaultValue: "rgba(17,17,17,.55)",
            },
            speed: {
                type: ControlType.Number,
                title: "Speed",
                defaultValue: 1,
                min: 0.5,
                max: 2,
                step: 0.1,
                displayStepper: true,
            },
        },
    },
    preview: {
        type: ControlType.Number,
        title: "Preview",
        description: "Canvas only: scrub the fold (0 = closed, 100 = end).",
        defaultValue: 30,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
    },
})
