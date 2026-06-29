import { createElement, type ReactNode } from 'react'

// Server-side HTML → React renderer for admin-authored Tiptap content.
//
// Rather than injecting a raw HTML string (an XSS vector even after sanitizing),
// we PARSE the HTML and re-emit ONLY an allowlist of tags and attributes as real
// React elements. Anything not on the allowlist is dropped; element text is
// preserved. This is a whitelist, not a blacklist, so unknown/dangerous markup
// (script, iframe, on* handlers, javascript: URLs) can never render.
//
// Tiptap emits a small, predictable tag set, which keeps this parser simple.

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code', 'hr',
  'a', 'img', 'figure', 'figcaption',
])

// Tags rendered as void (no children).
const VOID_TAGS = new Set(['br', 'hr', 'img'])

type Attrs = Record<string, string>

function safeUrl(value: string): string | null {
  const trimmed = value.trim()
  // Allow only http(s), mailto, tel, protocol-relative, and root/relative paths.
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed
  if (/^\/\//.test(trimmed)) return trimmed
  if (/^[./#?]/.test(trimmed) || !/:/.test(trimmed)) return trimmed
  return null // blocks javascript:, data:, vbscript:, etc.
}

// Keep only safe attributes per tag, scrubbing URLs.
function filterAttrs(tag: string, attrs: Attrs): Record<string, string> {
  const out: Record<string, string> = {}
  if (tag === 'a') {
    const href = attrs.href ? safeUrl(attrs.href) : null
    if (href) {
      out.href = href
      // Harden external links.
      out.rel = 'noopener noreferrer nofollow'
      out.target = '_blank'
    }
  } else if (tag === 'img') {
    const src = attrs.src ? safeUrl(attrs.src) : null
    if (src) out.src = src
    if (attrs.alt) out.alt = attrs.alt
    out.loading = 'lazy'
  }
  return out
}

// Minimal, dependency-free HTML tokenizer + tree builder. Handles tags, text,
// entities (left intact — React renders them), and self-closing tags. Comments
// and unknown constructs are skipped.
function parse(html: string): ReactNode[] {
  let i = 0
  let key = 0

  function parseNodes(stopTag: string | null): ReactNode[] {
    const nodes: ReactNode[] = []
    while (i < html.length) {
      if (html[i] === '<') {
        // Closing tag?
        if (html[i + 1] === '/') {
          const close = html.indexOf('>', i)
          if (close === -1) break
          const name = html.slice(i + 2, close).trim().toLowerCase()
          i = close + 1
          if (name === stopTag) return nodes
          continue // stray close — ignore
        }
        // Comment / doctype — skip.
        if (html.startsWith('<!--', i)) {
          const end = html.indexOf('-->', i)
          i = end === -1 ? html.length : end + 3
          continue
        }
        // Opening tag.
        const close = html.indexOf('>', i)
        if (close === -1) break
        let raw = html.slice(i + 1, close)
        const selfClose = raw.endsWith('/')
        if (selfClose) raw = raw.slice(0, -1)
        const [name, attrs] = parseTag(raw)
        i = close + 1

        const lower = name.toLowerCase()
        if (VOID_TAGS.has(lower)) {
          if (ALLOWED_TAGS.has(lower)) {
            nodes.push(createElement(lower, { key: key++, ...filterAttrs(lower, attrs) }))
          }
          continue
        }

        const children = parseNodes(lower)
        if (ALLOWED_TAGS.has(lower)) {
          nodes.push(createElement(lower, { key: key++, ...filterAttrs(lower, attrs) }, ...children))
        } else {
          // Unknown tag — drop the wrapper but keep its children inline.
          nodes.push(...children)
        }
      } else {
        // Text run up to the next tag.
        const next = html.indexOf('<', i)
        const text = html.slice(i, next === -1 ? html.length : next)
        if (text) nodes.push(text)
        i = next === -1 ? html.length : next
      }
    }
    return nodes
  }

  return parseNodes(null)
}

const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|(\S+)))?/g

function parseTag(raw: string): [string, Attrs] {
  const parts = raw.match(/^([a-zA-Z0-9]+)/)
  const name = parts ? parts[1] : ''
  const attrs: Attrs = {}
  const rest = raw.slice(name.length)
  // matchAll avoids stateful iteration; each match is one attribute.
  for (const m of rest.matchAll(ATTR_PATTERN)) {
    const attrName = m[1].toLowerCase()
    // Never carry over event handlers or inline styles.
    if (attrName.startsWith('on') || attrName === 'style') continue
    attrs[attrName] = m[3] ?? m[4] ?? m[5] ?? ''
  }
  return [name, attrs]
}

// Public API: parse trusted-but-unsanitized HTML into safe React nodes.
export function renderRichText(html: string | null | undefined): ReactNode {
  if (!html) return null
  return parse(html)
}
