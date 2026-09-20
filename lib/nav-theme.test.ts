import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { parseCssColor, resolveNavThemeFromElement } from './nav-theme'

describe('parseCssColor', () => {
  it('parses rgba with comma syntax and low alpha', () => {
    const result = parseCssColor('rgba(255, 255, 255, 0.025)')
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 0.025 })
  })

  it('parses rgba with space/slash syntax and percent alpha', () => {
    const result = parseCssColor('rgb(0 0 0 / 50%)')
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
  })

  it('parses green rgba with low alpha', () => {
    const result = parseCssColor('rgba(34, 184, 107, 0.08)')
    expect(result).toEqual({ r: 34, g: 184, b: 107, a: 0.08 })
  })

  it('parses opaque rgb (comma syntax)', () => {
    const result = parseCssColor('rgb(255, 255, 255)')
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 1 })
  })

  it('parses opaque rgb (space syntax)', () => {
    const result = parseCssColor('rgb(0 0 0)')
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 })
  })

  it('treats transparent as alpha 0', () => {
    const result = parseCssColor('transparent')
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('returns null for unparseable input', () => {
    expect(parseCssColor('invalid')).toBe(null)
    expect(parseCssColor('#fff')).toBe(null)
    expect(parseCssColor('hsl(0, 100%, 50%)')).toBe(null)
  })
})

describe('resolveNavThemeFromElement', () => {
  let container: HTMLDivElement
  let child: HTMLDivElement

  beforeEach(() => {
    container = document.createElement('div')
    child = document.createElement('div')
    container.appendChild(child)
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
  })

  it('returns dark when translucent white card sits on black ancestor', () => {
    // Simulates membership page: black root with rgba(255,255,255,0.025) card
    container.style.backgroundColor = 'rgb(0, 0, 0)'
    child.style.backgroundColor = 'rgba(255, 255, 255, 0.025)'

    const theme = resolveNavThemeFromElement(child)
    expect(theme).toBe('dark')
  })

  it('returns dark when green translucent banner sits on black', () => {
    container.style.backgroundColor = 'rgb(0, 0, 0)'
    child.style.backgroundColor = 'rgba(34, 184, 107, 0.08)'

    const theme = resolveNavThemeFromElement(child)
    expect(theme).toBe('dark')
  })

  it('returns light when opaque white background is found', () => {
    container.style.backgroundColor = 'rgb(255, 255, 255)'

    const theme = resolveNavThemeFromElement(container)
    expect(theme).toBe('light')
  })

  it('returns dark when opaque black background is found', () => {
    container.style.backgroundColor = 'rgb(0, 0, 0)'

    const theme = resolveNavThemeFromElement(container)
    expect(theme).toBe('dark')
  })

  it('walks up to find opaque ancestor when child is transparent', () => {
    container.style.backgroundColor = 'rgb(255, 255, 255)'
    child.style.backgroundColor = 'transparent'

    const theme = resolveNavThemeFromElement(child)
    expect(theme).toBe('light')
  })

  it('returns dark when no qualifying background is found (site default)', () => {
    // Neither container nor child has background set
    const theme = resolveNavThemeFromElement(child)
    expect(theme).toBe('dark')
  })

  it('ignores backgrounds with alpha just under threshold', () => {
    container.style.backgroundColor = 'rgb(0, 0, 0)'
    child.style.backgroundColor = 'rgba(255, 255, 255, 0.59)'

    // Child's white at 59% alpha should be ignored, walk to black ancestor
    const theme = resolveNavThemeFromElement(child)
    expect(theme).toBe('dark')
  })

  it('uses background with alpha at threshold (0.6)', () => {
    child.style.backgroundColor = 'rgba(255, 255, 255, 0.6)'

    // 60% alpha qualifies, white RGB → light
    const theme = resolveNavThemeFromElement(child)
    expect(theme).toBe('light')
  })
})
