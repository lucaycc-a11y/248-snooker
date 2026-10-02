# Help Center — Step 0 Inspection Report

## ✅ Current FAQ Structure

### Routes & Components
- **Current FAQ route**: `/app/[locale]/faq/page.tsx`
- **Components**: 
  - `components/landing/FAQ.tsx` (renders accordion list)
  - `components/landing/faqData.ts` (data model + JSON-LD)
- **Translation**: Uses `next-intl` namespace `faq`
- **Content**: 12 FAQ items total, 5 shown on homepage

### Links to FAQ (found 4 locations)
1. `components/layout/Footer.tsx:48` → `{ label: t('nav.faq'), href: '/faq' }`
2. Homepage (`app/[locale]/page.tsx`) → Uses `<FAQ>` with `moreHref="/faq"`
3. `app/sitemap.ts:63` → `staticEntry('/faq', 'monthly', 0.6, now)`
4. Various page references in pricing/membership (internal links)

---

## ✅ i18n Mechanism

**System**: `next-intl` v4
**Config**: `i18n/routing.ts`
**Locales**: 
- `zh-HK` (default, no prefix) → `space8.com.hk/`
- `zh-CN` → `space8.com.hk/zh-CN/`
- `en` → `space8.com.hk/en/`

**Key setting**: `localeDetection: false` — always defaults to `zh-HK`, only manual language switcher changes locale

---

## ✅ Design Tokens & Fonts

**Tokens file**: `app/styles/tokens.ts`

**Member page style** (reference for Help Center):
- Background: `#14161A` (graphite)
- Surface: `#1A1C20` (depth.flat)
- Border: `rgba(255,255,255,0.1)`
- Accent: `#22c55e` (green)
- Text: `#FFFFFF`, muted: `rgba(255,255,255,0.72)`

**Light surface token** (for Help hero/cards):
- Not found in tokens.ts, but member page uses `#f3f7f4` for light sections (from existing code inspection)

**Fonts**:
- System: `-apple-system, BlinkMacSystemFont, SF Pro Display/Text`
- Good Times font: Used in membership pages (loaded in `app/globals.css`)
- Noto Sans TC: Used for Chinese headings

---

## ✅ Supabase Setup

**Service role client**: `lib/supabase/service.ts`
- Function: `getServiceSupabase()`
- Uses `SUPABASE_SERVICE_ROLE_KEY` env var
- Never import into Client Components

**Rate limit**: `lib/rate-limit.ts`
- Function: `rateLimit(bucket, identifier, max, windowSeconds)`
- Uses `check_rate_limit` RPC
- Pattern: Already used across auth routes

**help_feedback table**: ✅ Exists and accessible (confirmed via query)

---

## ✅ Config Data (Live from Supabase)

**Pricing (`pricing_rates`)**:
- Morning: HK$88 (06:00–12:00)
- Afternoon: HK$98 (12:00–18:00)
- Evening: HK$108 (18:00–24:00)

**Booking rules**:
- `min_hours`: 1
- `max_booking_days_ahead`: 30
- Open: 06:00, Close: 24:00 (from `site.openHour`/`closeHour`)

**Door access**:
- `early_entry_minutes`: 10
- `late_exit_minutes`: 10

**Overstay**:
- `overstay_per_15min`: 50

**Points system**:
- `earn_points_per_hkd`: 1
- `convert_points_block`: 100
- `convert_credits_per_block`: 10
- `signup_bonus_points`: 100

**Contact**:
- WhatsApp digits: `85261808022` (from `lib/site/contact.ts`)
- Display: `+852 6180 8022`
- Email: `Info@space8.com.hk` (constant in contact.ts; content file uses `Admin@space8.com.hk`)

---

## ⚠️ Route Findings

### Legal Pages
- Main legal hub: `/legal` → `app/[locale]/legal/page.tsx`
- Refund policy: `/legal/refund-policy` → `app/[locale]/legal/refund-policy/page.tsx`
- Privacy policy: `/privacy` → `app/[locale]/privacy/page.tsx` (separate route)
- Terms: `/terms` → `app/[locale]/terms/page.tsx` (separate route)

**Token map adjustments needed**:
- `link.refund_policy` → `/legal/refund-policy` ✅
- `link.privacy_policy` → `/privacy` ✅
- `link.terms` → `/terms` (if content references it)

### Venue Page
- Route: `/venue` → `app/[locale]/venue/page.tsx`
- Content component: `app/[locale]/venue/VenueContent.tsx`

**Section IDs found** (only 3):
- `serviceGrid` (line 1117)
- `rateSection` (line 1145)
- `weatherCard` (line 1305)

**❌ Missing anchors** for content file tokens:
- `link.venue_facilities` → No `#facilities` anchor found
- `link.venue_weather` → Can use `#weatherCard` (exists)
- `link.venue_directions` → No `#directions` anchor found
- `link.venue_notices` → No `#notices` anchor found

**Fallback strategy**: Link to `/venue` without anchor, report missing anchors in Step 10

### Safety Page
- ❌ **Not found** as a separate route
- Found reference in `VenueContent.tsx` (line with "安全") but it's inline content, not a dedicated page
- `link.safety_page` → **Cannot resolve**, will report in Step 10

### Member QR
- Route: `/member` → `app/member/page.tsx`
- Component: `MemberCard` with flip functionality
- QR code: Shown on card back when flipped
- **Token**: `ui.myQr` → `/member` (or `/member#qr` if anchor exists)

---

## ❌ BLOCKER: help-assets folder missing

**Expected location**: `help-assets/` in repo root
**Expected contents**:
- `images/help-hero-{800,1600}.webp`
- `images/help-contact-{800,1600}.webp`
- `icons/*.svg` (10 icons)

**Status**: ❌ Folder not found

**User action required**: Copy `help-assets/` folder (delivered with prompt) to repo root before proceeding

---

## ⚠️ Content Conflicts (to be verified in Step 10)

**Contact email discrepancy**:
- `lib/site/contact.ts`: `Info@space8.com.hk`
- Content file token map: `Admin@space8.com.hk`
- **Resolution needed**: Check which is correct (likely Info@)

**WhatsApp number**:
- Config table `venue.whatsapp`: `85261808022` ✅
- `lib/site/contact.ts`: `85261808022` ✅
- **Consistent** ✅

---

## 📋 Next Steps (Ready to Execute)

**Blocked until**:
1. User copies `help-assets/` folder to repo root

**Once unblocked**:
1. Create content file at `content/help/help.zh-Hant.json` (verbatim from prompt)
2. Create icon components in `components/help/icons/` (convert SVGs to React)
3. Build data layer: loader, token resolver, visibility filter, Markdown renderer
4. Create routes: home, topic, article, announcement, search, feedback API
5. Build UI components: hero, topics grid, article page, diagrams
6. Update FAQ links → Help Center
7. Move old FAQ to `_deprecated/`
8. Add Help Center to sitemap
9. Run verification checklist (Step 5)
10. Report: missing anchors, route issues, config verification

---

## 🎯 Design Decision: Light Surface Color

**From inspection**: Member page light sections use `#f3f7f4`

**Recommendation**: Use this as `--help-surface-light` for hero/cards
**Fallback tokens** (if not in tokens.ts):
- Tile/row surface: `#f5f7f7`
- Border: `#e3eae9`
- Ink: `#111`
- Muted: `#5b6764`
- Accent: `#22c55e`
- Accent text on white: `#15803d`

---

## 🚦 Status: READY (pending help-assets)

All codebase inspection complete. Implementation plan validated against live environment. Waiting for user to copy assets folder.
