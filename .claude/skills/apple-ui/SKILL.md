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

## Typography
- Display: Bebas Neue (headings only)
- Body: SF Pro (-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui)
- NO emoji — use lucide-react icons only

## Apple Patterns
- FLUENT principle: price/key info is visual hero, large and prominent
- Sticky scroll storytelling (Pricing section)
- Progressive disclosure: + button (44×44px) → framer-motion modal
- Alternating dark/light sections
- Cards: rounded-2xl, 1px border, no shadow, padding 28px
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
