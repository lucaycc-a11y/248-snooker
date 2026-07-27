---
name: Apple UI Design
description: Use when building any UI component, page, or section. Enforces Apple-level design standards for 248 Snooker Club.
---

# Apple UI Design Skill

## Design Tokens
- Background: #000000 (dark sections) / #F5F5F7 (light sections)
- Text: white on dark, #1D1D1F on light, #86868B for secondary
- CTA Primary: #22C55E green
- CTA Secondary: #0071E3 blue
- Borders: 1px solid #2D2D2D (dark) / 1px solid #E5E5E5 (light)
- NO shadows — borders only
- Spring animation: cubic-bezier(0.16,1,0.3,1)

## Typography Hierarchy
```
Display hero:  Bebas Neue, 80-120px (headings only)
Section head:  SF Pro, 48-64px, bold
Card title:    SF Pro, 22-28px, 700
Body:          SF Pro, 15-17px, 400
Caption:       SF Pro, 13-14px, #86868B
```
Font stack: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif`
NO emoji — use lucide-react icons only.

## FLUENT Principle
Most important information (price, key stat) must be the **visual hero** — the largest element on screen. Never bury price in a label-value row.
- Bad: `Total Cost: HK$120`
- Good: `HK$120` at 64px bold, with `/小時` at 14px beside it

## Apple Card Pattern
```tsx
<div className="rounded-[18px] border border-[#2D2D2D] bg-[#1D1D1F] p-7 relative">
  <Icon size={28} className="text-white mb-5" strokeWidth={1.5} />
  <h3 className="text-white font-bold text-[22px] mb-3">Title</h3>
  <p className="text-[#86868B] text-[15px] leading-relaxed">
    Body with <span className="text-[#0071E3]">key words highlighted</span> inline.
  </p>
  <button className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
    <Plus size={16} color="white" strokeWidth={1.5} />
  </button>
</div>
```

## + Expand Button (Apple Proportion Rule)
- Outer circle: 44×44px (Apple minimum touch target)
- Dark bg: rgba(255,255,255,0.15), border rgba(255,255,255,0.2)
- Light bg: white, border rgba(0,0,0,0.12)
- Inner +: 16px, ~36% of circle diameter, perfectly centred
- Hover: scale(1.08) spring transition
- Click: opens AnimatePresence modal

## Modal Pattern (Apple overlay)
```tsx
<AnimatePresence>
  {open && (
    <motion.div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={close}
    >
      <motion.div
        className="bg-[#1D1D1F] rounded-[24px] p-8 max-w-md w-full"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={close} className="absolute top-4 right-4">
          <X size={20} color="#86868B" />
        </button>
        {/* content */}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>
```

## Scroll Storytelling (Pricing section)
- Section: height 300vh
- Inner: position sticky, top 0, height 100vh
- useScroll({ target: ref, offset: ['start start', 'end end'] })
- useMotionValueEvent to switch states at 0.33 / 0.66

## Section Rhythm (alternating)
```
Hero        → black #000000
Gallery     → dark grey #111
Pricing     → black #000000
HowItWorks  → light #F5F5F7
Member      → dark grey #1D1D1F
FAQ         → light #F5F5F7
Footer      → light #F5F5F7
```

## Other Apple Patterns
- Progressive disclosure: + button (44×44px) → framer-motion modal
- All tap targets minimum 44×44px
- Learn more links: "了解更多 ›" styled in accent colour
- Horizontal scroll carousels with snap for mobile

## Copy Rules
- No casual Cantonese (avoid: 冇驚喜, 著數 as slang)
- No emoji in UI copy
- Tagline: 香港 24 小時自助桌球
- ALL text needs data-cms-key="section_key" attribute
- Headings end with 。(Chinese full stop)

## Component Checklist
Before shipping any component:
- [ ] Mobile-first, tested at 375px
- [ ] All text has data-cms-key
- [ ] No emoji
- [ ] Touch targets ≥44px
- [ ] Framer Motion spring animations applied
- [ ] lucide-react icons (not emoji, not custom SVG)

## Anti-patterns (never do)
- ❌ Shadows (use borders instead)
- ❌ Emoji in UI
- ❌ Coloured card backgrounds (dark cards only)
- ❌ Generic placeholder grey buttons
- ❌ Label: Value table layout for pricing (use FLUENT hero instead)
- ❌ Arbitrary breakpoints (use sm/md/lg Tailwind only)
- ❌ Recreate 248 logo in code (import SVG from /public/logos/)
