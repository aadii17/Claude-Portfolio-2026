import { FAQ } from './content.js'
import { NO_MATCH, QA } from './knowledge.js'

/* Answers a visitor's question from knowledge.js (and the FAQ's own questions in content.js) by
 * matching words, in the browser. No AI, no server, nothing saved.
 * Each entry scores by the words it shares with the question: a keyword match counts most, a word
 * from the entry's question a bit less. The best entry wins if it scores enough; otherwise the
 * visitor gets NO_MATCH (which points to your email). */

// words that carry no meaning for matching
const STOP = new Set(
  ('a an the is are am was were be been do does did can could would should will shall may might must ' +
    'i me my you your yours he him his she her they them their we our it its this that these those ' +
    'what which who whom whose where when why how there here of in on at to for from by with about as into ' +
    'and or but if so than then too very just also any some much many more most please tell know want ' +
    'aadarsh choudhari s')
    .split(' '),
)

// one form per word: lowercase, no punctuation, simple plurals and endings trimmed
function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ies')) return `${w.slice(0, -3)}y`
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2)
  return w
}
const words = (text) =>
  text
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map(stem)
const meaningful = (text) => words(text).filter((w) => !STOP.has(w))

// the entries, prepared once: the FAQ's questions first, then knowledge.js
const ENTRIES = [
  ...FAQ.items.filter((i) => i.a).map((i) => ({ q: i.q, a: i.a.join(' '), keywords: [] })),
  ...QA,
].map((e) => ({
  ...e,
  qWords: new Set(meaningful(e.q)),
  keyWords: new Set((e.keywords || []).flatMap(words)),
}))

const MIN_SCORE = 3 // a keyword hit, or two words from an entry's question

export function answer(question) {
  const asked = [...new Set(meaningful(question))]
  if (!asked.length) {
    // only filler words ("hi", "hey" survive; "what is it" doesn't)
    return NO_MATCH
  }
  let best = null
  let bestScore = 0
  for (const e of ENTRIES) {
    let score = 0
    for (const w of asked) {
      const key = e.keyWords.has(w)
      const inQ = e.qWords.has(w)
      score += key && inQ ? 4 : key ? 3 : inQ ? 2 : 0
    }
    if (score > bestScore) (best = e), (bestScore = score)
  }
  return best && bestScore >= MIN_SCORE ? best.a : NO_MATCH
}
