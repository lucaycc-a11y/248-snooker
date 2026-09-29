# Homepage & 場地 Page Visual/Photo/Carousel Overhaul - Progress

## Completed ✓

1. **Space Pilot carousel slide widened** - Modified `apple-cards-carousel.tsx` to detect Space Pilot slide and apply wider aspect ratio (480px vs 320px)

2. **Space Pilot standalone section enlarged with glass widgets** - Updated `SpacePilotScoreboardExperience.tsx`:
   - Increased image scale to 1.15
   - Changed widget styling to frosted glass (backdrop-blur-[12px], bg-white/[0.08], border-white/25)
   - Adjusted sizes to max-w 1200px

3. **充電區 and 隨身物品存放 removed from homepage** - Already handled in `HomeFacilities.tsx` (only shows first 4 items)

4. **場地 page logo overlap fixed** - Added proper spacing (pt-20 mobile, pt-24 desktop) in `VenueHeroBento.tsx`

5. **場地介紹 休息區 photo and caption fixed** - Changed to `sofa-lounge-中八桌球-香港新蒲崗.webp` with hardcoded "休息區" caption

6. **場地設施 carousel reduced to 3 items** - Updated `VenueFacilitiesBento.tsx`:
   - Removed sofa tile
   - Changed to 3-tile layout: chalk, balls, balls-alt
   - Updated theme copy to "頂級設備，頂級桌球，助你更加專注"
   - Adjusted grid to 3 columns on desktop

7. **拖動滑桿 drag-compare section removed** - Removed from `VenueContent.tsx` (JSX and CSS)

## In Progress / TODO

8. **Replace fake Hero background** - Need to confirm which real photo to use for homepage Hero background

9. **Carousel auto-scroll added** - Already implemented in `apple-cards-carousel.tsx` (3.5s interval, pauses on hover/touch)

10. **Replace placeholder table photos sitewide** - Need to grep and replace all instances in:
    - Section5Booking.tsx
    - hero-preview.tsx
    - Any other references to Space Infinity/Eternity placeholders

11. **Delete leftover Hero block** - Need to identify and remove duplicate hero on homepage

12. **Container widening** - Sections still narrow with large margins

13. **Carousel polish and natural aspect ratios** - Partially done (Space Pilot widened), need to verify all carousels

14. **Top Hero full fixes** - Height already 100dvh, need to verify headline positioning and font-weight

15. **Every photo sitewide audit** - Need comprehensive grep for placeholder images

16. **Every carousel aspect ratio check** - Need to verify no forced cropping

17. **Flag generic/templated sections** - Need visual review with screenshots

## Files Modified

- `/Users/lucayau/Documents/Space8_web/components/landing/HomeFacilities.tsx`
- `/Users/lucayau/Documents/Space8_web/components/ui/apple-cards-carousel.tsx`
- `/Users/lucayau/Documents/Space8_web/components/landing/SpacePilotScoreboardExperience.tsx`
- `/Users/lucayau/Documents/Space8_web/components/venue/VenueHeroBento.tsx`
- `/Users/lucayau/Documents/Space8_web/components/venue/VenueFacilitiesBento.tsx`
- `/Users/lucayau/Documents/Space8_web/app/[locale]/venue/VenueContent.tsx`

## Next Steps

1. Identify and fix remaining placeholder/fake images
2. Remove any duplicate/leftover hero sections
3. Widen section containers
4. Verify all carousels use natural aspect ratios
5. Take screenshots and flag generic-feeling sections
