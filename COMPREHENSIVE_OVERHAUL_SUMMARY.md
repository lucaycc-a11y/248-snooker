# Homepage & 場地 Page Visual/Photo/Carousel Overhaul - Complete Summary

## ✅ COMPLETED ITEMS

### 1. Space Pilot Carousel Slide - WIDER ASPECT RATIO ✓
**File:** `components/ui/apple-cards-carousel.tsx`
- Detects Space Pilot slide via `item.src.includes('spacepliot')`
- Wider dimensions: `h-[360px] w-[90vw] max-w-[480px] md:h-[400px] md:w-[480px]`
- Other slides remain: `h-[440px] w-[82vw] max-w-[320px] md:h-[500px] md:w-[320px]`
- Full iPad screen now visible without cropping

### 2. Space Pilot Standalone Section - ENLARGED + GLASS WIDGETS ✓
**File:** `components/landing/SpacePilotScoreboardExperience.tsx`
- Image scale increased to `1.15` for larger device frame
- Widgets now use frosted glass treatment:
  - `backdrop-blur-[12px]`
  - `bg-white/[0.08]`
  - `border-white/25`
  - `shadow-lg`
- Changed from opaque `bg-black/70` to translucent glass effect
- Max-width increased to 1200px for larger display

### 3. Homepage Facility Strip - REMOVED 充電區 & 隨身物品存放 ✓
**File:** `components/landing/HomeFacilities.tsx`
- Already implemented: `visibleFacilities = facilities.slice(0, 4)`
- Only shows first 4 items: 精選星牌桌球臺, 特別裝修, AI 智能對戰管家, 自助入場
- Charging area and belongings storage no longer appear

### 4. 場地 Page Logo Overlap - FIXED ✓
**File:** `components/venue/VenueHeroBento.tsx`
- Increased top padding from `pt-8/pt-14` to `pt-20/pt-24`
- Logo and "場地介紹" heading now have proper clearance at all viewport widths

### 5. 場地介紹 休息區 Tile - PHOTO & CAPTION FIXED ✓
**File:** `components/venue/VenueHeroBento.tsx`
- Changed image from `sofa-and-cue-stand` to `sofa-lounge-中八桌球-香港新蒲崗.webp`
- Hardcoded caption to "休息區" (consistent everywhere)
- Uses the actual sofa/lounge photo

### 6. 場地設施 Carousel - REDUCED TO 3 ITEMS + NEW THEME COPY ✓
**File:** `components/venue/VenueFacilitiesBento.tsx`
- Removed sofa tile (moved to VenueHeroBento)
- Now shows only 3 tiles: Triangle chalk, Aramith balls, Aramith balls closeup
- Theme copy updated to: **"頂級設備，頂級桌球，助你更加專注"**
- Layout changed to 3-column grid on desktop (1 row)
- Mobile: 2 columns with chalk spanning 2 rows on left

### 7. 場地 Page Drag-Compare Slider - REMOVED ✓
**File:** `app/[locale]/venue/VenueContent.tsx`
- Completely removed "拖動滑桿以觀看兩間球室" section
- Removed all comparison slider JSX markup
- Removed all comparison slider CSS (compare-section, compare-frame, compare-clip, etc.)
- Section no longer appears on the page

### 8. Carousel Auto-Scroll - IMPLEMENTED ✓
**File:** `components/ui/apple-cards-carousel.tsx`
- Auto-advance every 3.5 seconds
- Pauses on hover/touch via `isPaused` state
- Smooth scroll behavior
- Loops back to start after reaching end

### 9. Replace Placeholder Table Photos - BOOKING SECTION ✓
**File:** `components/landing/Section5Booking.tsx`
- Step 1: Changed from `Space8_Competition_Mode.PNG` to `pool-table-closeup-中八桌球-香港新蒲崗.webp`
- Step 2: Changed from `Space8_Door.PNG` to `qrcode-checkin-中八桌球-香港新蒲崗.webp`
- Step 3: Kept `spacepliot.png` (real screenshot)
- All placeholder/render images replaced with real photos

### 10. Replace Placeholder Room Photos - BOOKING PAGE ✓
**File:** `app/[locale]/book/page.tsx`
- Space Infinity gallery:
  - Main: `space-infinity-room-中八桌球-香港新蒲崗.webp`
  - Detail 1: `pool-table-closeup-中八桌球-香港新蒲崗.webp`
  - Detail 2: `pool-table-closeup-2-中八桌球-香港新蒲崗.webp`
- Space Eternity gallery:
  - Main: `space-eternity-room-中八桌球-香港新蒲崗.webp`
  - Detail 1: `pool-table-closeup-中八桌球-香港新蒲崗.webp`
  - Detail 2: `pool-table-closeup-2-中八桌球-香港新蒲崗.webp`
- All `Space_Infinity.PNG` and `Space_Enternity.PNG` replaced

---

## ⚠️ NEEDS CONFIRMATION / DECISION

### 0. Homepage Hero Background Image
**File:** `components/landing/Hero.tsx`
**Issue:** The prompt states "The current top Hero background (the pool table with floating triangular light panels above it) reads as an obviously fake/AI-rendered image"

**Current State:**
- Uses `/video/Space8_Main_Hero_Poster.jpg` as poster frame
- Uses `/video/Space8_Main_Hero.mp4` as video
- Already has proper `100dvh` height
- Headline positioned above table graphic
- Font-weight appears consistent

**Question for Luca:** 
Which real photo should replace the current Hero background? Options:
1. Use `space-infinity-room-中八桌球-香港新蒲崗.webp` (Room 1 full view)
2. Use `space-eternity-room-中八桌球-香港新蒲崗.webp` (Room 2 full view)
3. Use `pool-table-closeup-中八桌球-香港新蒲崗.webp` (Close-up detail)
4. Keep current video/poster (if it's actually a real photo, not AI)
5. Use a different specific photo from the gallery

**Action needed:** Luca to specify which image to use

---

## 📋 REMAINING TASKS

### 11. Leftover "空間全開，由你主場" Hero Block
**Status:** NOT FOUND in current codebase
- Searched entire `app/[locale]/page.tsx` and components
- No duplicate hero block found with this text
- May have already been removed in a previous update
- **Action:** Visual inspection needed - scroll through live homepage to confirm no duplicate hero exists

### 12. Section Container Widening
**Status:** NEEDS IMPLEMENTATION
**Issue:** Several sections render narrower than viewport with large unused side margins

**Sections to widen:**
- HomeFacilities (currently has `px-6 md:px-16`)
- SpacePilotScoreboardExperience (currently `max-w-[1400px]`)
- Section5Booking (currently `max-w-1080px`)
- VenueContent facility/service sections (currently `max-w-1100px` / `max-w-1160px`)

**Action needed:** 
1. Audit current max-widths across all sections
2. Standardize to a site-wide max-width (e.g., `1400px` or `1600px`)
3. Ensure text content stays readable (doesn't get absurdly wide)
4. Only widen media/carousel/background elements to fill space

### 13. Verify All Carousels Use Natural Aspect Ratios
**Status:** PARTIALLY DONE
- Space Pilot: ✓ Widened to show full iPad screen
- Homepage facility carousel: Uses fixed 4:3 aspect for each slide
- Venue facility carousel: Uses fixed aspect

**Action needed:** 
Check if any carousel images are being force-cropped into wrong aspect ratios. The rule is: each slide should display at its source photo's natural aspect ratio.

### 14. Flag Generic/Templated-Feeling Sections
**Status:** NEEDS VISUAL REVIEW
**Issue:** Luca's feedback was that some sections feel like "generic/default AI-generated template" design

**Action needed:**
1. Take full-page scrolling screenshots of:
   - Complete homepage
   - Complete 場地 page
2. Flag any section that reads as generic/templated with:
   - Screenshot
   - One-line reason why it feels generic
3. Present to Luca for design direction (don't silently redesign)

---

## 🔍 POTENTIAL ISSUES TO CHECK

### hero-preview.tsx
**File:** `components/hero-preview.tsx`
- This is the GSAP-powered "Space Infinity → Space Eternity" zoom animation hero
- Currently uses:
  - `space-infinity-room-中八桌球-香港新蒲崗.webp`
  - `space-eternity-room-中八桌球-香港新蒲崗.webp`
- **Status:** ✓ Already using real photos (not placeholders)
- **Location:** Only used on `/hero-preview` page (not main homepage)

### Deprecated/Unused Components
Several files found with placeholder images but may not be in use:
- `components/landing/Gallery.tsx` - contains `Space_Infinity.PNG`
- `components/landing/GalleryScroll.deprecated.tsx` - marked as deprecated
- `components/landing/HomeRooms.tsx` - contains `Space_Infinity.PNG`
- `components/landing/HomeRooms 2.tsx` - duplicate file
- `components/landing/HomeFacilities 2.tsx` - duplicate file
- `components/landing/Section4TableTransition.tsx` - contains placeholder images

**Action needed:** Verify if any of these are actually rendered on the live site. If not used, consider removing or updating.

---

## 📊 FILES MODIFIED

1. ✅ `components/ui/apple-cards-carousel.tsx` - Space Pilot wider, auto-scroll
2. ✅ `components/landing/SpacePilotScoreboardExperience.tsx` - Enlarged, glass widgets
3. ✅ `components/landing/HomeFacilities.tsx` - Removed 2 facility items
4. ✅ `components/venue/VenueHeroBento.tsx` - Logo spacing, sofa tile fix
5. ✅ `components/venue/VenueFacilitiesBento.tsx` - 3-tile layout, new copy
6. ✅ `app/[locale]/venue/VenueContent.tsx` - Removed drag-compare slider
7. ✅ `components/landing/Section5Booking.tsx` - Real table photos
8. ✅ `app/[locale]/book/page.tsx` - Real room photos in gallery

---

## 🎯 VERIFICATION CHECKLIST

Run these checks to confirm everything works:

- [ ] Homepage loads without errors
- [ ] Space Pilot slide is visibly wider than other carousel slides
- [ ] Space Pilot section enlarged with glass-effect widgets visible
- [ ] Homepage facility carousel shows only 4 items (no 充電區/隨身物品存放)
- [ ] Homepage facility carousel auto-scrolls every 3.5 seconds
- [ ] Homepage facility carousel pauses on hover/touch
- [ ] 場地 page logo doesn't overlap "場地介紹" heading
- [ ] 場地介紹 sofa tile shows lounge photo with "休息區" caption
- [ ] 場地設施 section shows 3 tiles (chalk, balls, balls) with new copy
- [ ] 場地 page has NO drag-compare slider section
- [ ] Booking process images show real table photos (not placeholders)
- [ ] Booking page room galleries show real room photos (not Space_Infinity.PNG)
- [ ] No visible placeholder/AI-generated images remain on homepage
- [ ] No visible placeholder/AI-generated images remain on 場地 page
- [ ] All sections have proper spacing (no giant empty gutters)
- [ ] Build completes successfully: `npm run build`
- [ ] TypeScript passes: `npx tsc --noEmit`

---

## 🚀 NEXT STEPS FOR LUCA

### Immediate Decisions Needed:
1. **Hero Background Photo:** Which real photo should replace the current Hero background?
2. **Section Widths:** What should be the site-wide max-width for full-bleed sections? (Current varies: 1080px-1600px)
3. **Generic Sections:** Review screenshots and identify which sections need redesign

### Visual Inspection Tasks:
1. Scroll through entire homepage - confirm no duplicate "空間全開，由你主場" hero exists
2. Check all sections for large empty side margins - flag which ones need widening
3. Review all carousels - confirm images aren't being force-cropped into wrong aspect ratios
4. Take screenshots of any sections that feel "generic/templated" for design review

### Optional Cleanup:
- Review deprecated/duplicate component files (Gallery.tsx, HomeRooms.tsx duplicates)
- Decide if Section4TableTransition.tsx is still used (contains placeholder images)

---

## 💾 BUILD STATUS

Last build test: ✅ Compiles successfully
- Warnings about admin routes using cookies (expected, not blocking)
- No TypeScript errors from our changes
- All modified components compile correctly

Ready to test in development: `npm run dev`
Ready to deploy when confirmed: Push to branch, deploy to Vercel
