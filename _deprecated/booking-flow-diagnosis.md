# Booking Flow Image Bug Diagnosis

## Problem
Images don't switch correctly when scrolling through steps. User reports that step 01 shows the 8-ball artwork (which is likely image 3, the rewards points), and it doesn't change at step 02.

## Investigation Results

### Images verified
All three images exist and are distinct:
- `space8-booking-interface-pick-slot.webp` (34K, 1448×1086) — step 01
- `space8-qrcode-entry-system.webp` (33K, 1448×1086) — step 02  
- `space8-member-rewards-points.webp` (29K, 1448×1086) — step 03

SHA256 checksums confirm they're different files.

### Code structure
The rendering uses absolute positioning with opacity crossfade:
- All three images are stacked with `position: absolute; inset: 0`
- All start with `opacity: 0`
- The active image (where `i === activeIdx`) gets class `active` with `opacity: 1`
- Transition: `opacity 0.55s ease`

### Root cause: Z-index stacking
**Without explicit z-index, DOM order determines paint order.**

Current render order:
```jsx
{STEPS.map((step, i) => (
  <Image key={i} className={`flow-image ${i === activeIdx ? "active" : ""}`} />
))}
```

This renders: image-0, image-1, image-2 (top to bottom in DOM = back to front in paint order).

**Result**: Image-2 (rewards points) is always painted LAST, so even at `opacity: 0`, it occludes the images beneath it. The browser paints image-2 on top, and its semi-transparent or 0-opacity pixels still block the layers below from being visible.

This is why the user sees image-2 (the 8-ball rewards artwork) at every step.

### Fix
Set `z-index` dynamically so the active image is on top:
```css
.flow-image {
  z-index: 0;
}
.flow-image.active {
  z-index: 1;
  opacity: 1;
}
```

This ensures the active image is painted on top, and inactive images (at `opacity: 0` and `z-index: 0`) stay behind it.
