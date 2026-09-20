import { describe, it, expect } from 'vitest'
import { parseCssColor, resolveNavThemeFromElement } from './nav-theme'

describe('parseCssColor', () => {
  it('parses rgba with comma syntax and low alpha as transparent', () => {
    const result = parseCssColor('rgba(255,255,255,0.025)')
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 0.025 })
  })

  it('parses rgba with space/slash syntax', () => {
    const result = parseCssColor('rgb(0 0 0 / 50%)')
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
  })

  it('parses green translucent card correctly', () => {
    const result = parseCssColor('rgba(34,184,107,0.08)')
    expect(result).toEqual({ r: 34, g: 184, b: 107, a: 0.08 })
  })

  it('parses opaque rgb', () => {
    const result = parseCssColor('rgb(255,255,255)')
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 1 })
  })

  it('treats transparent keyword as alpha 0', () => {
    const result = parseCssColor('transparent')
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('returns null for unparseable input', () => {
    expect(parseCssColor('invalid')).toBeNull()
    expect(parseCssColor('#ffffff')).toBeNull()
  })

  it('parses alpha as percentage', () => {
    const result = parseCssColor('rgba(255, 255, 255, 50%)')
    expect(result).toEqual({ r: 255, g: 255, b: 255, a: 0.5 })
  })
})

describe('resolveNavThemeFromElement', () => {
  it('returns dark when translucent white card sits on black background', () => {
    // Simulates: <div style="background: black"><div style="background: rgba(255,255,255,0.025)">...</div></div>
    const container = document.createElement('div')
    container.style.backgroundColor = 'rgb(0, 0, 0)'

    const card = document.createElement('div')
    card.style.backgroundColor = 'rgba(255,255,255,0.025)'
    container.appendChild(card)

    document.body.appendChild(container)

    const theme = resolveNavThemeFromElement(card)
    expect(theme).toBe('dark')

    document.body.removeChild(container)
  })

  it('returns dark when green translucent banner sits on black background', () => {
    const container = document.createElement('div')
    container.style.backgroundColor = 'rgb(0, 0, 0)'

    const banner = document.createElement('div')
    banner.style.backgroundColor = 'rgba(34,184,107,0.08)'
    container.appendChild(banner)

    document.body.appendChild(container)

    const theme = resolveNavThemeFromElement(banner)
    expect(theme).toBe('dark')

    document.body.removeChild(container)
  })

  it('returns light for opaque white background', () => {
    const el = document.createElement('div')
    el.style.backgroundColor = 'rgb(255, 255, 255)'
    document.body.appendChild(el)

    const theme = resolveNavThemeFromElement(el)
    expect(theme).toBe('light')

    document.body.removeChild(el)
  })

  it('walks up to find opaque background when element has transparent background', () => {
    const container = document.createElement('div')
    container.style.backgroundColor = 'rgb(0, 0, 0)'

    const textEl = document.createElement('span')
    textEl.style.backgroundColor = 'transparent'
    container.appendChild(textEl)

    document.body.appendChild(container)

    const theme = resolveNavThemeFromElement(textEl)
    expect(theme).toBe('dark')

    document.body.removeChild(container)
  })

  it('returns dark as fallback when no opaque background is found', () => {
    const el = document.createElement('div')
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.1)'
    document.body.appendChild(el)

    const theme = resolveNavThemeFromElement(el)
    expect(theme).toBe('dark')

    document.body.removeChild(el)
  })
})
