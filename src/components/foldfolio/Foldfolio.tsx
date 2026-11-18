import type { ComponentProps } from 'react'
import FoldfolioDevice from './FoldfolioDevice'

/* Framer fills every property from its control's `defaultValue` before rendering the component.
 * This wrapper does the same, so <Foldfolio /> behaves exactly like the Framer version with its
 * defaults, and you only pass what you want to change (nested settings merge, e.g.
 * layout={{ portraitBelow: 760 }} keeps the other layout defaults). */

type DeviceProps = ComponentProps<typeof FoldfolioDevice>
type Control = { type?: string; defaultValue?: unknown; controls?: Record<string, Control> }

function defaultsOf(controls: Record<string, Control>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, c] of Object.entries(controls)) {
    if (c.type === 'object' && c.controls) out[key] = defaultsOf(c.controls)
    else if (c.defaultValue !== undefined) out[key] = c.defaultValue
  }
  return out
}

const controls = (FoldfolioDevice as unknown as { propertyControls?: Record<string, Control> }).propertyControls ?? {}
const DEFAULTS = defaultsOf(controls)

export type FoldfolioProps = Partial<{
  [K in keyof DeviceProps]: DeviceProps[K] extends object ? Partial<DeviceProps[K]> : DeviceProps[K]
}>

export default function Foldfolio(props: FoldfolioProps) {
  const merged: Record<string, unknown> = { ...DEFAULTS }
  for (const [key, value] of Object.entries(props)) {
    const base = DEFAULTS[key]
    merged[key] =
      base && typeof base === 'object' && !Array.isArray(base) && value && typeof value === 'object' && !Array.isArray(value)
        ? { ...base, ...value }
        : value
  }
  return <FoldfolioDevice {...(merged as unknown as DeviceProps)} />
}
