import FoldPhoneDevice from './FoldPhoneDevice'

/* The phone's settings and their defaults (the values the FoldPhone template ships with).
 * Pass only what you want to change; nested settings merge, e.g. layout={{ top: 32 }} keeps the
 * other layout defaults. Slots (screen, cover, nav, …) are passed straight through. */
const DEFAULTS = {
  finish: 'titanium', // frame colour: titanium | graphite | coral | sage (a visitor's pick is remembered)
  screenColor: '#0B0B0B', // behind the screen content, as #rrggbb
  switcher: { right: 28, bottom: 18 }, // colour dots: distance from the bottom (and from the left on small screens)
  layout: { portraitBelow: 700, top: 72, bottom: 32, maxScale: 1.3 }, // flip phone below this width; space around the phone
  motion: { openLength: 1.15, closeLength: 1.1, holdLength: 0.4, smoothing: 0.12, float: true }, // scroll lengths in screen heights
  intro: { line: 'rgba(17,17,17,.55)', speed: 1 }, // opening curtain: seam colour, speed (color: curtain colour, default = backdrop)
}

// The defaults with your settings merged in (also used by things on the desk mat to find the phone).
export function withDefaults(props) {
  const merged = { ...DEFAULTS }
  for (const [key, value] of Object.entries(props)) {
    const base = DEFAULTS[key]
    merged[key] =
      base && typeof base === 'object' && value && typeof value === 'object' && !Array.isArray(value)
        ? { ...base, ...value }
        : value
  }
  return merged
}

export default function FoldPhone(props) {
  return <FoldPhoneDevice {...withDefaults(props)} />
}
