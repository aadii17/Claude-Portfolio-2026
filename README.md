# Fold phone

A scroll-driven folding phone, shown on a precision-grid desk mat. Scroll to unfold it.

- Wide screens show a **Galaxy Z Fold 8**-style book fold; phones show a **Z Flip 8**-style flip fold.
- Closed, the cover screen is a lock screen with a live India-time clock and two notifications (tap one to unfold).
- Open, the inner display holds a single-page portfolio that scrolls inside the phone, with its own floating nav.
- The colour dots under the phone change the frame finish.
- The background is the "Precision Grid Deskmat": a 16px grid with 80px major lines, numbered rulers, angle guides and a registration mark.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173 (also on your LAN IP, to try it on a phone)
npm run build    # production build in dist/
```

## Where things live

| File | What it is |
| --- | --- |
| `src/components/foldfolio/FoldfolioDevice.tsx` | The folding-phone component (from the Foldfolio Framer template). Edits are marked `[Z8]`. |
| `src/components/foldfolio/framer-shim.ts` | Stand-in for the `framer` package, so the component runs in plain React (aliased in `vite.config.ts`). |
| `src/components/foldfolio/Foldfolio.tsx` | Applies the template's default settings and merges overrides. |
| `src/components/foldfolio/FoldfolioHero.tsx` | Mounts the phone and fills its slots (screens, cover, nav, backdrop). |
| `src/components/portfolio/` | The portfolio shown on the inner display (`content.ts` holds all the text). |
| `src/components/site/` | Lock screen, desk-mat background, India-time clock, name and links (`site.ts`). |

To show a resume download button on the inner display, add the PDF to `public/` and set `PROFILE.resume` in `src/components/portfolio/content.ts`.
