# Venue Page Rebuild — Sub-agent Plan

## Phase 0 Inspection Complete

### Prerequisites Check

✅ **Universal Pricing Component:** `components/ui/pricing-cards.tsx` exists with `theme` prop supporting `light` and `dark`.

✅ **Universal HowToGo Component:** `components/landing/HowToGo.tsx` exists with `theme` prop and map support.

### Assets Inspection

All assets verified:

| Asset | Dimensions | Aspect | Format | Notes |
|---|---|---|---|---|
| `venue-page-infinity.jpg` | 2400×1500 | 16:10 | JPEG, no alpha | Room 1 panorama |
| `venue-page-eternity.jpg` | 2400×1500 | 16:10 | JPEG, no alpha | Room 2 panorama |
| `about-06-lounge.webp` | 1600×1067 | 3:2 | WebP, no alpha | Infinity sofa area |
| `about-07-stools.webp` | 1600×1067 | 3:2 | WebP, no alpha | Eternity bar stools |
| `about-03-corner-pocket.webp` | 1600×1067 | 3:2 | WebP, no alpha | Table corner pocket detail |
| `venue-interior-中八桌球-香港新蒲崗.webp` | 6549×4366 | 3:2 | WebP, no alpha | Full room interior |
| `aramith-balls-box.png` | 4156×2933 | ~3:2 | PNG, **no alpha** | Aramith box product shot |
| `/gallery/spacepliot.png` | (from Home) | — | PNG | Space Pilot iPad screen |

**Stage image decision for 專業設備 (pill 3):**
- `about-03-corner-pocket.webp` shows a clean table corner with balls in the triangle.
- `venue-interior-中八桌球-香港新蒲崗.webp` shows the full room with the table.
- `aramith-balls-box.png` is a product shot but has **no transparency**, so CSS layering would require masking or a new edit.
- **Recommended:** Use `about-03-corner-pocket.webp` as-is (clean, professional, already shows the equipment). The interior photo is too wide for the stage area; the Aramith box lacks alpha for clean layering.

**Hero photos:**
- Current Hero uses: Check needed (Agent C will inspect and report).
- RoomViewer will use: `venue-page-infinity.jpg`, `venue-page-eternity.jpg`, `about-06-lounge.webp`, `about-07-stools.webp`, `about-03-corner-pocket.webp`, `/gallery/spacepliot.png`.
- De-duplication: Agent C will remove any Hero photo whose source file appears in the RoomViewer list.

### Current Venue Page Structure

File: `app/[locale]/venue/VenueContent.tsx`

Current sections (in order):
1. CinematicOrbitHero
2. Venue Points (membership-style statements) — light bg
3. Room comparison (two-room slider) — dark
4. AppleCardCarousel (其他設施) — inherits from prior section
5. HomePricing (periods from config)
6. Notes (留意事項) — dark
7. Weather (惡劣天氣) — dark
8. Directions (inline, not HowToGo component) — light

### Components to Deprecate

These will move to `components/landing/_deprecated/` or `components/ui/_deprecated/`:
- Six-card facility grid (currently inlined in VenueContent)
- The inline two-room comparison slider (Reveal2 component)
- Space Pilot four-point block (currently in "Venue Points")
- AppleCardCarousel detail content (only the carousel component itself)

### RoomViewer Status

**Does not exist yet.** Agent A will build it from scratch.

### ThreePoints Status

**Does not exist yet.** Agent B will build it as a universal component in `components/ui/`.

---

## Sub-agent File Ownership

| Agent | Files Owned (exclusive write access) | Runs |
|---|---|---|
| **Agent A — RoomViewer** | `components/ui/RoomViewer.tsx`<br>`lib/data/venue-rooms.ts` (room data)<br>`messages/zh-HK.json` (add `venue.rooms.*` keys only)<br>`app/[locale]/venue/preview/room-viewer/page.tsx` (preview route) | Parallel with B, C |
| **Agent B — ThreePoints** | `components/ui/ThreePoints.tsx`<br>`messages/zh-HK.json` (add `venue.whyUs.*` keys only) | Parallel with A, C |
| **Agent C — Hero** | `components/ui/cinematic-orbit-hero.tsx` (fixes only, no rewrite)<br>`messages/zh-HK.json` (add `venue.hero.*` keys only) | Parallel with A, B; de-duplication step waits for A's image list |
| **Agent D — Page** | `app/[locale]/venue/VenueContent.tsx` (full rewrite)<br>`messages/zh-HK.json` (add `venue.page.*`, `venue.service.*`, `venue.notes.*` keys)<br>Deprecation moves to `_deprecated/` | After A, B, C finish |
| **QA** | Read-only: all files, screenshots at 390px, 820px, 1440px | After D |

---

## Shared Resources (read-only for all agents)

- `components/ui/pricing-cards.tsx` — universal pricing with `theme` prop
- `components/landing/HowToGo.tsx` — universal directions with `theme` prop and map
- `app/styles/tokens.ts` — design tokens
- `public/images/*` — all assets (never rename, move or overwrite)
- Supabase `config` table — pricing and rules (read-only checks only)

---

## i18n Namespace Plan

Each agent writes keys only under its own namespace:

- Agent A: `venue.rooms.*` (section title, slider hint, pill labels, room names, small lines)
- Agent B: `venue.whyUs.*` (heading, three card texts with `{before, accent, after}` structure)
- Agent C: `venue.hero.*` (heading, body)
- Agent D: `venue.page.*` (pricing heading/subheading), `venue.service.*` (服務說明 updated line), `venue.notes.*` (留意事項 item 02 only)

Agent D will merge all namespaces and remove unused keys after integration.

---

## Design Tokens to Use

From `app/styles/tokens.ts`:

```typescript
tokens.colors.bg           // #14161A (graphite, dark sections)
tokens.colors.surface      // #1A1C20 (dark cards)
tokens.colors.border       // rgba(255,255,255,0.1)
tokens.colors.text         // #FFFFFF
tokens.colors.textMuted    // rgba(255,255,255,0.72)
tokens.colors.textFaint    // rgba(255,255,255,0.52)
tokens.colors.brand        // #25D366 (green accent)
tokens.colors.green.600    // #16a34a (accent option)
tokens.radius.card         // 20px
tokens.radius.pill         // 999px
tokens.easing.spring       // cubic-bezier(0.16,1,0.3,1)
tokens.font.sans           // system font
tokens.font.display        // Good Times
```

Light section colors (for Why Us, 服務說明, 留意事項, HowToGo):
- Background: `#ffffff` or `#f5f5f7` (Apple light grey)
- Card background: `#ffffff`
- Card border: `rgba(0,0,0,0.06)` to `rgba(0,0,0,0.14)`
- Text: `#1d1d1f` to `#111110`
- Text muted: `#6e6e73` to `rgba(17,17,16,0.58)`

---

## Mobile-First Rules (All Agents)

- Design at 390px first, then 820px, then 1440px.
- Use `svh`/`dvh` (not `vh`) for full-height sections.
- Respect `env(safe-area-inset-*)` on iOS.
- No horizontal page overflow — wide content scrolls inside its container.
- Fixed aspect ratios on all images (no layout shift).
- Lazy-load below the fold; prefetch only default state.
- No hover-only interactions — swipe, tap, keyboard must all work.
- Body text ≥15px; secondary text ≥13px.
- Parallax/scroll effects: desktop pointer only, off on touch and `prefers-reduced-motion`.
- All tap targets ≥44px.

---

## Animation Rules (All Agents)

- Routine reveals: `cubic-bezier(.2,.7,.3,1)` (tokens.easing.spring)
- Pop entrances (small elements only, not text blocks): `cubic-bezier(.34,1.56,.64,1)`
- Use Framer Motion or GSAP ScrollTrigger (already in project); no new libraries.
- All motion off under `@media (prefers-reduced-motion: reduce)`.

---

## Git Strategy

Each agent commits **once** after completing its work:
- Agent A: `feat(venue): Add RoomViewer component with two-room slider`
- Agent B: `feat(venue): Add universal ThreePoints component`
- Agent C: `fix(venue): Fix Hero layering and de-duplicate photos`
- Agent D (two commits):
  1. `feat(venue): Rebuild Venue page with new structure`
  2. `feat(venue): Add section transitions and micro-parallax` (separate so it's easy to revert)

No pushes. The orchestrator (main agent) verifies and reports.

---

## Next Steps

1. Orchestrator spawns Agents A, B, C in parallel (all read-only prerequisites met).
2. Agent C's de-duplication step waits for Agent A to report its final image list.
3. Once A, B, C finish, orchestrator spawns Agent D.
4. Once D finishes, orchestrator spawns QA agent.
5. QA agent reports findings; orchestrator summarizes and hands back to Luca.

---

**Status:** Plan written. Ready to spawn sub-agents.
