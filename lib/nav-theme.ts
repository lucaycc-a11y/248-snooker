/**
 * Nav theme detection utilities — RGBA-aware color parsing and ancestor-walk
 * background resolution for Nav.tsx's floating pill theme.
 */

export type ParsedColor = { r: number; g: number; b: number; a: number }

/**
 * Parse CSS color strings (rgb/rgba) into { r, g, b, a }.
 * Supports both comma syntax and space/slash syntax, alpha as decimal or percent.
 * Returns null for unparseable input; treats 'transparent' as alpha 0.
 */
export function parseCssColor(input: string): ParsedColor | null {
  const trimmed = input.trim().toLowerCase()

  if (trimmed === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 }
  }

  // Match rgb(r, g, b) or rgba(r, g, b, a) with comma separators
  const commaRgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/
  let match = trimmed.match(commaRgba)
  if (match) {
    const r = parseInt(match[1], 10)
    const g = parseInt(match[2], 10)
    const b = parseInt(match[3], 10)
    let a = 1
    if (match[4] !== undefined) {
      if (match[4].endsWith('%')) {
        a = parseFloat(match[4]) / 100
      } else {
        a = parseFloat(match[4])
      }
    }
    return { r, g, b, a }
  }

  // Match rgb(r g b) or rgb(r g b / a) with space/slash separators
  const spaceRgba = /^rgba?\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+%?)\s*)?\)$/
  match = trimmed.match(spaceRgba)
  if (match) {
    const r = parseInt(match[1], 10)
    const g = parseInt(match[2], 10)
    const b = parseInt(match[3], 10)
    let a = 1
    if (match[4] !== undefined) {
      if (match[4].endsWith('%')) {
        a = parseFloat(match[4]) / 100
      } else {
        a = parseFloat(match[4])
      }
    }
    return { r, g, b, a }
  }

  return null
}

/**
 * Resolve nav theme by walking from `start` element up through ancestors,
 * looking for the first opaque background (a >= 0.6). Returns 'dark' if
 * luminance < 128, 'light' otherwise. Falls back to 'dark' (site-default)
 * if no qualifying background is found.
 *
 * Explicit `data-nav-theme` attributes are handled BEFORE this function is
 * called — this is only the fallback when no attribute is found.
 */
export function resolveNavThemeFromElement(start: Element): 'dark' | 'light' {
  let el: Element | null = start

  // Walk from start element up to <html>, checking backgrounds
  while (el && el !== document.documentElement.parentElement) {
    const bg = window.getComputedStyle(el).backgroundColor
    const parsed = parseCssColor(bg)

    if (parsed && parsed.a >= 0.6) {
      // Found an opaque background — decide theme by luminance
      const lum = (parsed.r * 299 + parsed.g * 587 + parsed.b * 114) / 1000
      return lum < 128 ? 'dark' : 'light'
    }

    el = el.parentElement
  }

  // No qualifying background found — use site default (dark-first)
  return 'dark'
}
