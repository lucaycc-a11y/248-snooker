---
name: SPACE8
description: Reservation-based self-service Chinese eight-ball club — dark, minimal, green-accented
colors:
  bg: "#000000"
  surface: "#111111"
  surface-elevated: "#1A1A1A"
  border: "rgba(255,255,255,0.1)"
  border-strong: "rgba(255,255,255,0.18)"
  text: "#FFFFFF"
  text-muted: "rgba(255,255,255,0.72)"
  text-faint: "rgba(255,255,255,0.52)"
  brand: "#25D366"
  brand-hover: "#1FB855"
  brand-dim: "rgba(37,211,102,0.12)"
  brand-text: "#000000"
  link: "#22c55e"
  danger: "#FF453A"
typography:
  display:
    fontFamily: '"Bebas Neue", sans-serif'
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "system-ui, -apple-system, SF Pro Text, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  input: "12px"
  button: "14px"
  card: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
  "3xl": "64px"
  "4xl": "96px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.brand-text}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "52px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
  button-primary-disabled:
    backgroundColor: "{colors.brand-dim}"
    textColor: "rgba(0,0,0,0.5)"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    border: "1px solid {colors.border-strong}"
    height: "52px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.button}"
    padding: "0 24px"
    height: "52px"
  card-default:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    border: "1px solid {colors.border}"
  card-elevated:
    backgroundColor: "{colors.surface-elevated}"
    rounded: "{rounded.card}"
    border: "1px solid {colors.border}"
  input:
    backgroundColor: "rgba(255,255,255,0.06)"
    textColor: "{colors.text}"
    rounded: "{rounded.input}"
    border: "1px solid {colors.border}"
    height: "52px"
  input-focus:
    border: "1px solid {colors.brand}"
  input-error:
    border: "1px solid {colors.danger}"
---

# Design System: SPACE8

## Overview

**Creative North Star: "The Cue Sports Sanctuary"**

SPACE8 is a dark, minimal, Apple-inspired design system built for a premium self-service snooker club. The system is defined by a total black canvas (`#000000`), subtle glass surfaces, and a single green accent drawn from the snooker table felt. It channels the quiet focus of a pool hall at night — the green felt is the only colour that matters, and everything else recedes into darkness.

The atmosphere is refined, tactile, and deliberate. Surfaces are layered through transparency and blur rather than shadows, creating depth without visual weight. Typography is clean and neutral (SF Pro) with a sharp display accent (Bebas Neue) for headlines. Motion is spring-based, responsive, and feels physical — buttons depress, sheets slide, cards respond to touch.

**Key Characteristics:**
- Black canvas (`#000000`) with layered dark surfaces (glass, elevated, flat)
- Single green accent (`#25D366`) — reserved for primary actions, active states, and brand moments
- Glassmorphism for navigation and overlay surfaces (blur + semi-transparent backgrounds)
- Spring-based motion with scale-down press feedback on interactive elements
- Rounded corners (20px cards, 14px buttons, 12px inputs) — Apple-inspired radius hierarchy
- Bebas Neue for display headlines; SF Pro system stack for body text
- No shadows — depth is conveyed through tonal layering and glass blur instead

## Colors

### Primary
- **Brand Green** (`#25D366` / `oklch(0.75 0.2 150)`): The single accent colour, drawn from snooker table felt. Used for primary buttons, active/selected states, focus rings, links, and the WhatsApp brand moment. Never applied as a background colour on large surfaces — its power comes from scarcity.

### Neutral
- **Pitch Black** (`#000000`): The dominant background. The entire canvas is black; no other colour competes at this scale.
- **Surface Dark** (`#111111`): Default card, container, and section background. One step off pure black — barely perceptible, but enough to define a boundary.
- **Surface Elevated** (`#1A1A1A`): Elevated cards, modal backgrounds, and hover states. The highest solid surface tone.
- **Border Light** (`rgba(255,255,255,0.1)`): Default dividers and card borders. Subtle — defines edges without calling attention.
- **Border Strong** (`rgba(255,255,255,0.18)`): Secondary button borders, prominent dividers, glass surface borders.
- **White** (`#FFFFFF`): Primary text and headings.
- **Text Muted** (`rgba(255,255,255,0.72)`): Secondary text, labels, and body copy.
- **Text Faint** (`rgba(255,255,255,0.52)`): Placeholder text, captions, and hint text.

### Semantic
- **Link** (`#22c55e`): Inline links and link-style buttons.
- **Danger** (`#FF453A`): Apple System Red — error states, destructive actions, validation failures.

### Glass
- **Glass Background** (`rgba(255,255,255,0.05)` with `backdrop-filter: blur(20px) saturate(180%)`): Navigation bar, sheets, member dashboard, admin sidebar.
- **Glass Border** (`rgba(255,255,255,0.18)`): Outlines glass surfaces.

### Named Rules
**The Green Felt Rule.** Brand green (`#25D366`) is used on ≤10% of any given screen. Its rarity is the point — it signals the one thing the user should do. Overuse dilutes the snooker-felt metaphor and flattens the hierarchy.

**The Black Canvas Rule.** The background is always `#000000`. No dark grey, no gradient, no pattern. The black is the silence that makes the green sing.

## Typography

**Display Font:** Bebas Neue (sans-serif fallback)
**Body Font:** SF Pro Text / system-ui, -apple-system, Helvetica Neue, sans-serif

**Character:** A two-voice system built for contrast. Bebas Neue delivers sharp, condensed, all-caps headlines — authoritative and spacious. SF Pro provides the neutral, highly legible reading face. The pairing is utilitarian with attitude: the display face says "this is the club," the body face says "here's how it works."

### Hierarchy
- **Display** (400, `clamp(2.5rem, 7vw, 4.5rem)`, 1): Hero headlines, section titles. Bebas Neue, all-caps by nature. Generous letter-spacing for emphasis.
- **Headline** (600, `clamp(1.25rem, 3vw, 1.75rem)`, 1.2): Section subtitles, feature headings. SF Pro Bold.
- **Title** (500, `1rem`–`1.125rem`, 1.3): Card titles, nav items, button labels.
- **Body** (400, `16px`–`18px`, 1.5–1.75): Paragraphs, descriptions, feature copy. Max line length 65–75ch for readability.
- **Label** (500, `13px`–`14px`, 1.4, `0.01em` letter-spacing): Form labels, timestamps, metadata, captions.

### Named Rules
**The One-Typeface Rule.** Bebas Neue is the only display face. No decorative, script, or secondary display font. The branding is built on the tension between one loud voice and one quiet voice — a third voice breaks the polarity.

## Layout

SPACE8 uses a full-bleed, single-column layout on mobile with a max-width container (`1200px`) on desktop. The layout is driven by generous vertical rhythm (`24px` / `48px` / `64px` / `96px` spacing scale) rather than a traditional grid.

- **Mobile-first:** All layouts are designed for small screens first. The primary booking flow is thumb-driven.
- **Vertical rhythm:** Sections are separated by `64px`–`96px` of vertical space. Internal section padding uses `24px`–`32px`.
- **Container:** Max-width `1200px` centred, with `24px` horizontal padding on mobile, `32px`–`48px` on desktop.
- **Full-bleed hero:** The landing hero spans the full viewport height (`100dvh`), with content overlaid on video or image.
- **Card strips:** Horizontal scroll carousels for pricing, venue, and gallery cards. Touch-scrollable with `touch-action: pan-x pan-y` and `overscroll-behavior-x: contain`.

## Elevation & Depth

SPACE8 is a **flat-by-default, glass-layered** system. There are no box shadows. Depth is conveyed exclusively through:

1. **Tonal layering:** Surfaces stack from `#000000` (bg) → `#111111` (surface) → `#1A1A1A` (elevated). Each step up is a barely perceptible brightening.
2. **Glassmorphism:** Navigation, sheets, and overlay panels use `backdrop-filter: blur()` with semi-transparent backgrounds. The glass effect creates an illusion of physical depth — the content behind the glass is visible but occluded.
3. **Scale press:** Interactive elements (buttons, cards) depress to `scale(0.97)` on pointer down, creating a tactile sense of physical depth.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. No shadows, no gradients, no decorative depth. Elevation appears only through tonal surface change or glass blur — never through drop shadows.

## Shapes

The system uses an Apple-inspired radius hierarchy with four tiers:

- **Pill** (`999px`): Navigation bar, tags, chips, small badges. Fully rounded.
- **Card** (`20px`): Cards, containers, modals, sheets. The most common surface radius.
- **Button** (`14px`): All button variants. Subtle rounding — feels intentional but not soft.
- **Input** (`12px`): Text inputs, form fields. Slightly less rounded than buttons for visual distinction.

Borders are `1px solid` using the border colour tokens. No double borders, no inset borders, no decorative outlines. The glass surface variant uses `rgba(255,255,255,0.18)` for its border.

## Components

### Buttons
- **Shape:** Rounded (14px). No border-radius on `link` variant.
- **Primary:** Solid brand green (`#25D366`) with black text. 52px default height, 700 weight text. Hover shifts to `#1FB855`. Press scales to `0.97`. Disabled dims to `rgba(37,211,102,0.12)` with grey text.
- **Secondary:** Transparent background, white text, 1px solid `rgba(255,255,255,0.18)` border. 500 weight.
- **Ghost:** Transparent background, muted text. No border.
- **Link:** Inline style, no border, link green (`#22c55e`) text, chevron icon.
- **Sizes:** sm (40px), md (52px, default), lg (56px). Full-width option available.
- **Transition:** `all 150ms cubic-bezier(0.4,0,0.2,1)`.

### Cards
- **Shape:** Rounded (20px). 1px border.
- **Default:** `#111111` background, `rgba(255,255,255,0.1)` border.
- **Elevated:** `#1A1A1A` background, `rgba(255,255,255,0.1)` border.
- **Gradient:** Subtle green-tinted gradient (`rgba(255,255,255,0.03)` → `rgba(34,197,94,0.05)`) over `#111111` base.
- **Glass:** Transparent background with `backdrop-filter: blur(20px) saturate(180%)` and `rgba(255,255,255,0.18)` border.
- **Padding:** Uses spacing scale — default `24px`.

### Inputs
- **Shape:** Rounded (12px). 52px height. Dark fill (`rgba(255,255,255,0.06)`).
- **Default:** 1px `rgba(255,255,255,0.1)` border.
- **Focus:** Border shifts to brand green (`#25D366`). No ring/glow — the border colour change is the only indicator.
- **Error:** Border shifts to danger red (`#FF453A`) with 13px error text below.
- **Internal padding:** 16px left/right (or 14px when an icon slot is present).

### Navigation
- **Shape:** Pill-shaped bar (`border-radius: 999px`), fixed to the top of the viewport.
- **Background:** Glass — `rgba(255,255,255,0.05)` with `backdrop-filter: blur(24px) saturate(180%)`.
- **Border:** 1px `rgba(255,255,255,0.10)`.
- **Light theme variant:** White-tinted glass (`rgba(255,255,255,0.76)`) with `rgba(0,0,0,0.10)` border — used on light-background sections.
- **Items:** 500 weight text, active state uses brand green. Mobile shows a hamburger menu with a full-screen overlay.

### Sheet / Modal
- **Mobile:** Bottom sheet — slides up from bottom with spring animation. `85vh` max height. Drag handle at top (40×4px pill). Rounded top corners (20px).
- **Desktop:** Centered modal — fades in with scale. Max width 420px, 90% width. `80vh` max height.
- **Overlay:** `rgba(0,0,0,0.6)`, fade transition.
- **Background:** `#1A1A1A` (surface elevated), 1px `rgba(255,255,255,0.1)` border.

### Skeleton / Loading
- Placeholder shimmer animation for content loading states. Uses a shimmer keyframe that sweeps a gradient across the skeleton element once.

## Do's and Don'ts

### Do:
- **Do** use brand green sparingly — ≤10% of any screen. Let the black canvas do the heavy lifting.
- **Do** use Bebas Neue for display headlines that need to command attention. It's the only display face for a reason.
- **Do** layer surfaces tonally (`#000` → `#111` → `#1A1A1A`) to create depth without shadows.
- **Do** use the glass effect for navigation, overlays, and surfaces that need to feel elevated without being solid.
- **Do** use the spring easing (`cubic-bezier(0.16,1,0.3,1)`) for motion — it makes interactions feel physical.

### Don't:
- **Don't** use box shadows anywhere. SPACE8 is a shadow-free system. Depth comes from tonal layering and glass blur.
- **Don't** introduce a second accent colour. The green is the single voice — no orange, no blue, no purple.
- **Don't** use the brand green as a large background fill. It's for buttons, active states, and accents — not hero sections.
- **Don't** use decorative typography beyond Bebas Neue. No script fonts, no slab serifs, no novelty typefaces.
- **Don't** use gradients on backgrounds unless it's the predefined card gradient variant. The system is flat at rest.
- **Don't** use `#000` text on dark surfaces. White text on dark backgrounds is the system default; brand green buttons get black text for contrast.
- **Don't** hardcode pricing, booking time, or tier logic. The `config` table is the single source of truth.