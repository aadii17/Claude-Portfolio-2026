import { useSyncExternalStore } from 'react'

/* Shared UI state for the portfolio. Foldfolio renders the open screen once per half (two copies
 * of the same page), so anything interactive must live outside the components: both copies read
 * the same store, and a search typed in one half filters the cards in the other half too. */

export type Form = { name: string; email: string; message: string }
export type FormErrors = Partial<Record<keyof Form, string>>

type State = {
  query: string
  filter: string // 'All' or a project category
  open: Record<string, boolean> // FAQ items
  form: Form
  errors: FormErrors
  sent: boolean
  active: string // nav item last chosen
}

let state: State = {
  query: '',
  filter: 'All',
  open: { work: true },
  form: { name: '', email: '', message: '' },
  errors: {},
  sent: false,
  active: 'home',
}
const subs = new Set<() => void>()

export const store = {
  get: () => state,
  set: (patch: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
    subs.forEach((f) => f())
  },
  subscribe: (f: () => void) => {
    subs.add(f)
    return () => void subs.delete(f)
  },
}

export function usePortfolio() {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/* A clock shared by both copies, so the hero's rotating word changes in sync. */
const TICK_MS = 2600
let tick = Math.floor(Date.now() / TICK_MS)
const tickSubs = new Set<() => void>()
let timer = 0
const tickStore = {
  subscribe: (f: () => void) => {
    tickSubs.add(f)
    if (tickSubs.size === 1) {
      timer = window.setInterval(() => {
        tick = Math.floor(Date.now() / TICK_MS)
        tickSubs.forEach((g) => g())
      }, 250)
    }
    return () => {
      tickSubs.delete(f)
      if (!tickSubs.size) window.clearInterval(timer)
    }
  },
  get: () => tick,
}
export function useTick(enabled: boolean) {
  const t = useSyncExternalStore(tickStore.subscribe, tickStore.get, tickStore.get)
  return enabled ? t : 0
}

/* Scroll the phone so a section is at the top of its screen. In-screen links can't use #anchors
 * (the screen's content scrolls with the page), so this asks Foldfolio via its `ff:scrollto` hook. */
export function goTo(id: string) {
  const roots = [...document.querySelectorAll<HTMLElement>('.pf')].filter((r) => r.offsetWidth > 0)
  const root = roots[roots.length - 1]
  const target = root?.querySelector<HTMLElement>(`[data-pf="${id}"]`)
  if (!root || !target) return
  let y = 0
  for (let n: HTMLElement | null = target; n && n !== root; n = n.offsetParent as HTMLElement | null) y += n.offsetTop
  store.set({ active: id })
  window.dispatchEvent(new CustomEvent('ff:scrollto', { detail: { y: Math.max(0, y - 40) } }))
}
