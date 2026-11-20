/* "The site is on screen": set by the loader (SiteLoader.jsx) as it starts revealing the page.
 * Things on the desk wait for it so they settle in after the reveal, not hidden under the loader.
 * Also adds `site-ready` to <html> for CSS (see .neko-toggle in index.css). */

let ready = false
const subs = new Set()

export const isSiteReady = () => ready

export function onSiteReady(cb) {
  if (ready) {
    cb()
    return () => {}
  }
  subs.add(cb)
  return () => void subs.delete(cb)
}

export function markSiteReady() {
  if (ready) return
  ready = true
  document.documentElement.classList.add('site-ready')
  subs.forEach((f) => f())
  subs.clear()
}
