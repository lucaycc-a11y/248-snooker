# Scroll Dead Zone / Sticky Lock Fix

## Root cause

Commit `929c6ee` set `overflow-x: hidden` on both `html` and `body`. When both
are non-visible, `body` no longer propagates overflow to the viewport and
becomes its own scroll container. Every `position: sticky` then pinned to
`body` instead of the viewport and scrolled away with the page.

Symptoms this caused (all one bug):
- Home: Space Pilot section did not lock; booking-flow stage/steps scrolled
  off, leaving the 260vh section as a blank grey band (the "dead zone").
- Venue: CinematicOrbitHero stage scrolled off, leaving a black 350vh band.

## Fix

`app/globals.css`: horizontal-overflow guard on `body` only; `html` left
`visible` so body's overflow propagates to the viewport.

An earlier attempt that shrank the booking flow `260vh` → `calc(100vh + 280px)`
only hid the symptom and has been reverted.

## Measured (WebKit, iPad Pro 11 landscape 1194×834, touch, localhost)

| Sticky element | Pinned range | Drift before | Drift after |
|---|---|---|---|
| Home – Space Pilot | 966px | ~1166px | 0px |
| Home – booking stage | 1668px | ~882px | 0px |
| Venue – orbit hero | 2085px | ~2430px | 0px |

Also checked at 810×1080 portrait and iPhone 12: drift 0, no horizontal overflow.

## Tests

- `tests/sticky-lock-diagnostic.spec.ts` – every tall sticky element on each
  route must stay at its sticky `top` across its pinned range.
- `tests/scroll-dead-zone-suite.spec.ts` – luminance sweep (std < 12 for
  > 160px fails) + footer reachable at maxScroll.

```bash
npx playwright test tests/sticky-lock-diagnostic.spec.ts --project=webkit
npx playwright test tests/scroll-dead-zone-suite.spec.ts --project=webkit
```
