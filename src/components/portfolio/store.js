import { useSyncExternalStore } from 'react'

/* Shared UI state for the open screen. FoldPhone renders the screen once per half (two copies
 * of the same page), so anything interactive must live outside the components: both copies read
 * the same store. */

let state = {
  active: 'home', // the section the nav pill highlights
}
const subs = new Set()

export const store = {
  get: () => state,
  set: (patch) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) }
    subs.forEach((f) => f())
  },
  subscribe: (f) => {
    subs.add(f)
    return () => void subs.delete(f)
  },
}

export function usePortfolio() {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

/* Scroll the phone so a section fills its screen. In-screen links can't use #anchors
 * (the screen's content scrolls with the page), so this asks FoldPhone via its `ff:scrollto` hook. */
export function goTo(id) {
  const roots = [...document.querySelectorAll('.pf')].filter((r) => r.offsetWidth > 0)
  const root = roots[roots.length - 1]
  const target = root?.querySelector(`[data-pf="${id}"]`)
  if (!root || !target) return
  let y = 0
  for (let n = target; n && n !== root; n = n.offsetParent) y += n.offsetTop
  store.set({ active: id })
  window.dispatchEvent(new CustomEvent('ff:scrollto', { detail: { y } }))
}
