import { useSyncExternalStore } from 'react'

/* One shared clock for everything on the phone (status bar + lock screen): the current time in
 * India, 24-hour "HH:MM", so it always agrees with the IST clock in the page's top-right corner. */

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export const indiaHHMM = (d = new Date()) => fmt.format(d)

let current = indiaHHMM()
const listeners = new Set()
let timer = 0

// tick on the minute boundary, not on a fixed interval, so the phone flips exactly with the real clock
const schedule = () => {
  const now = Date.now()
  timer = window.setTimeout(() => {
    const next = indiaHHMM()
    if (next !== current) {
      current = next
      listeners.forEach((l) => l())
    }
    schedule()
  }, 60_000 - (now % 60_000) + 50)
}

const subscribe = (cb) => {
  listeners.add(cb)
  if (listeners.size === 1) {
    current = indiaHHMM()
    schedule()
  }
  return () => {
    listeners.delete(cb)
    if (!listeners.size) window.clearTimeout(timer)
  }
}

export function useIndiaTime() {
  return useSyncExternalStore(subscribe, () => current, () => current)
}
