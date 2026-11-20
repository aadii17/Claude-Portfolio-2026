import { SITE } from './site'

/* The sheet's corner labels: your name and role top-left, the sheet notes top-right, the copyright
 * bottom-right (top-right on phones).
 * Used on the desk mat (FoldPhoneHero's backdrop, under the phone) and in the loader at exactly the
 * same spots, so they stay put through the reveal. Each sits on a patch of mat colour so the mat's
 * top ruler doesn't run through it. Styles: .sheet-label in index.css. */

export function SheetTitle() {
  return (
    <div className="sheet-label sheet-title">
      <div className="sheet-name">{SITE.name}</div>
      <div className="sheet-muted">{SITE.role}</div>
    </div>
  )
}

export function SheetInfo() {
  return (
    <div className="sheet-label sheet-info">
      <div>Sheet 01 — Fold phone</div>
      <div className="sheet-muted">Scale 1 : 1</div>
      <div className="sheet-muted">19.0760° N&nbsp;&nbsp; 72.8777° E</div>
    </div>
  )
}

export function SheetCopyright() {
  return <div className="sheet-label sheet-copy">© {SITE.year} {SITE.name}</div>
}

export default function SheetLabels() {
  return (
    <>
      <SheetTitle />
      <SheetInfo />
      <SheetCopyright />
    </>
  )
}
