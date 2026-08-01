# CMS Architecture — Before & After

## BEFORE: Disconnected Sources ❌

```
┌─────────────────────────────────────────────────────────┐
│                    Admin CMS Editor                      │
│                      (/admin/cms)                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓ Writes draft
              ┌────────────────────┐
              │   cms_versions     │
              │   (drafts table)   │
              └─────────┬──────────┘
                        │
                        ↓ Publish
              ┌────────────────────┐
              │   cms_content      │
              │   (live edits)     │
              └────────────────────┘
                        ✗ NOT READ BY FRONTEND
                        
                        
┌─────────────────────────────────────────────────────────┐
│                  messages/*.json                         │
│          (Static JSON checked into git)                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓ Build time import
              ┌────────────────────┐
              │   i18n/request.ts  │
              │   (next-intl)      │
              └─────────┬──────────┘
                        │
                        ↓ Returns static only
              ┌────────────────────┐
              │   Frontend Pages   │
              │   (uses static)    │
              └────────────────────┘
              
PROBLEM: Two separate content sources never connected.
Admin edits disappeared into void.
```

---

## AFTER: Hybrid Architecture ✅

```
┌─────────────────────────────────────────────────────────┐
│                    Admin CMS Editor                      │
│                      (/admin/cms)                        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ↓ Writes draft
              ┌────────────────────┐
              │   cms_versions     │
              │   (drafts table)   │
              └─────────┬──────────┘
                        │
                        ↓ Publish
              ┌────────────────────┐
              │   cms_content      │◄────┐
              │   (live overrides) │     │
              └────────────────────┘     │
                        ↑                │
                        │                │
                        └─────┐          │
                              │          │
┌─────────────────────────────┼──────────┼──────────────┐
│         messages/*.json     │          │               │
│    (Static base fallback)   │          │               │
└──────────────────────┬──────┘          │               │
                       │                 │               │
                       ↓ 1. Load static │               │
              ┌────────────────────┐    │               │
              │   i18n/request.ts  │    │               │
              │                    │    │               │
              │ 2. Fetch DB  ──────┼────┘               │
              │ 3. Merge     ◄─────┼────────────────────┤
              │    DB over static  │                    │
              └─────────┬──────────┘                    │
                        │                               │
                        ↓ Returns merged                │
              ┌────────────────────┐                    │
              │   CMSProvider      │                    │
              │ (Realtime sub) ────┼────────────────────┘
              └─────────┬──────────┘        ↑
                        │                   │
                        ↓ Provides merged   │ Live updates
              ┌────────────────────┐        │
              │    CMSText         │────────┘
              │  (reads merged)    │
              └─────────┬──────────┘
                        │
                        ↓ Renders
              ┌────────────────────┐
              │   Frontend Pages   │
              │ (shows DB override │
              │  or static base)   │
              └────────────────────┘
              
SOLUTION: Two-layer content system
1. Server merge: static + DB (initial load)
2. Client Realtime: instant updates (post-publish)
```

---

## Key Features

### ✅ Admin Edits Work
- Admin changes cms_content → Next page load shows new value
- No rebuild/redeploy needed

### ✅ Real-time Updates
- CMSProvider subscribes to cms_content changes
- Text updates instantly when admin publishes
- No page refresh needed

### ✅ Safe Fallback
- DB query fails? → Falls back to static JSON
- Missing DB key? → Uses static default
- Zero downtime even if Supabase down

### ✅ Git-tracked Baseline
- messages/*.json checked into repo
- Developers can edit translations via PR
- CMS overrides are overlaid on top

---

## Data Flow Example

**Scenario:** Admin changes pricing hero title

```
1. Admin clicks edit on "為咗識得計數嘅人。"
   ↓
2. Writes to cms_versions (draft)
   ↓
3. Admin clicks publish
   ↓
4. Upserts to cms_content:
   key: "pricingPage.hero_line1"
   locale: "zh-HK"
   value: "聰明人嘅定價方案"
   ↓
5. Next visitor loads /pricing:
   
   Server (i18n/request.ts):
   - Loads messages/zh-HK.json → base
   - Queries cms_content WHERE locale='zh-HK'
   - Finds override for pricingPage.hero_line1
   - Merges: base["pricingPage"]["hero_line1"] = "聰明人嘅定價方案"
   - Returns merged to NextIntlClientProvider
   ↓
6. Client renders:
   <CMSText k="pricingPage.hero_line1">
     {t("hero_line1")} {/* reads merged value */}
   </CMSText>
   ↓
7. Output: "聰明人嘅定價方案" ✅
```

---

## Comparison Table

| Feature | Before | After |
|---------|--------|-------|
| **Admin edits appear?** | ❌ No | ✅ Yes |
| **Needs rebuild?** | ❌ Yes | ✅ No |
| **Real-time updates?** | ❌ No | ✅ Yes |
| **Fallback if DB fails?** | ❌ No (breaks) | ✅ Yes (static) |
| **Git-tracked content?** | ✅ Yes | ✅ Yes |
| **CMS edit history?** | ✅ Yes | ✅ Yes |
| **Performance** | Fast (static) | Fast (1 query/page) |

---

## Migration Path

### Step 1: Deploy Code ✅
```bash
git push origin security/booking-backend-hardening
# Vercel auto-deploys
```

### Step 2: Seed Database
```bash
# In production environment (Vercel CLI or local with prod creds)
export NEXT_PUBLIC_SUPABASE_URL="https://wqmciwieiqvnswvspdyz.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-key"
npm run cms:seed
```

This populates cms_content with baseline from messages/*.json.

### Step 3: Verify
1. Load https://248.formhk.com/pricing
2. Open /admin, edit a pricing field
3. Publish
4. Refresh /pricing
5. ✅ Change should appear

### Step 4: Monitor
- Check Vercel logs for DB query performance
- Verify no errors in Supabase logs
- Test all 4 locales (zh-HK, zh-CN, en, ja)

---

## Technical Details

### Merge Algorithm
```typescript
// Pseudocode
function merge(static, db) {
  result = deepClone(static)
  
  for (key, value in db) {
    path = key.split('.')  // "pricingPage.hero_line1" → ["pricingPage", "hero_line1"]
    set_nested(result, path, value)  // result["pricingPage"]["hero_line1"] = value
  }
  
  return result
}
```

### Cache Strategy (Future)
```typescript
// Add Redis caching to reduce DB load
const cacheKey = `cms:${locale}`
const cached = await redis.get(cacheKey)
if (cached) return JSON.parse(cached)

const fresh = await getCMSMap(locale)
await redis.set(cacheKey, JSON.stringify(fresh), { ex: 300 }) // 5min TTL
return fresh
```

### ISR Strategy (Future)
```typescript
// Add revalidate to pricing page
export const revalidate = 60 // Re-fetch CMS every 60 seconds
```

---

## Maintenance

### Adding New Translations
1. Add to `messages/*.json` (static fallback)
2. Commit and deploy
3. Admin can override via CMS later

### Bulk Content Updates
Use the seed script:
```bash
# Update messages/*.json
# Then re-seed
npm run cms:seed
```

### Reverting a Change
Use the CMS history UI in `/admin/cms/history` to republish an older version.

---

**Status:** ✅ Implemented and ready for deployment
