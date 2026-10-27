'use client'

/**
 * AiText — how every AI answer in the admin is displayed.
 *
 *  • Answers shaped like 「結論：…／原因：…／建議：…」 become labelled sections, so the one-line
 *    conclusion stands out and the rest reads as supporting detail.
 *  • Everything else is rendered as Markdown (paragraphs, lists, bold, code, tables).
 *  • Member codes can become buttons that open that member (when the page passes a resolver).
 */

import { Children, Fragment, isValidElement, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MEMBER_CODE_RE = /SPACE8-[A-Z0-9]+(?:-[A-Z0-9]+)+/g

type SectionKind = 'conclusion' | 'reason' | 'data' | 'next'
const SECTION_LABELS: { re: RegExp; kind: SectionKind; label: string }[] = [
  { re: /^結論[：:]\s*/, kind: 'conclusion', label: '結論' },
  { re: /^(原因|分析)[：:]\s*/, kind: 'reason', label: '原因' },
  { re: /^數據[：:]\s*/, kind: 'data', label: '數據' },
  { re: /^(建議下一步|建議)[：:]\s*/, kind: 'next', label: '建議' },
]

type Section = { kind: SectionKind | 'plain'; label: string; body: string }

export function parseAnswerSections(text: string): Section[] | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const sections: Section[] = []
  let current: Section | null = null
  let labelled = 0
  for (const line of lines) {
    const trimmed = line.trim()
    const hit = SECTION_LABELS.find((s) => s.re.test(trimmed))
    if (hit) {
      labelled += 1
      current = { kind: hit.kind, label: hit.label, body: trimmed.replace(hit.re, '') }
      sections.push(current)
    } else if (current) {
      current.body += `\n${line}`
    } else if (trimmed !== '') {
      current = { kind: 'plain', label: '', body: line }
      sections.push(current)
    }
  }
  if (labelled < 2) return null
  return sections.map((s) => ({ ...s, body: s.body.trim() }))
}

function linkify(
  text: string,
  resolve?: (code: string) => string | null,
  open?: (id: string) => void,
): ReactNode {
  if (!resolve || !open) return text
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(MEMBER_CODE_RE)) {
    const idx = m.index ?? 0
    const id = resolve(m[0])
    if (!id) continue
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(
      <button key={`${m[0]}-${idx}`} type="button" className="mb-code-link admin-mono" onClick={() => open(id)}>
        {m[0]}
      </button>,
    )
    last = idx + m[0].length
  }
  if (last === 0) return text
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

type LinkProps = {
  resolveMember?: (code: string) => string | null
  onOpenMember?: (id: string) => void
}

function mapText(children: ReactNode, p: LinkProps): ReactNode {
  return Children.map(children, (child, i) => {
    if (typeof child === 'string') return <Fragment key={i}>{linkify(child, p.resolveMember, p.onOpenMember)}</Fragment>
    if (isValidElement(child)) return child
    return child
  })
}

export function Markdown({ text, resolveMember, onOpenMember }: { text: string } & LinkProps) {
  const p = { resolveMember, onOpenMember }
  return (
    <div className="ai-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{mapText(children, p)}</p>,
          li: ({ children }) => <li>{mapText(children, p)}</li>,
          td: ({ children }) => <td>{mapText(children, p)}</td>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

export default function AiText({ text, resolveMember, onOpenMember }: { text: string } & LinkProps) {
  const sections = parseAnswerSections(text)
  if (!sections) return <Markdown text={text} resolveMember={resolveMember} onOpenMember={onOpenMember} />
  return (
    <div className="ai-sections">
      {sections.map((s, i) =>
        s.kind === 'plain' ? (
          <Markdown key={i} text={s.body} resolveMember={resolveMember} onOpenMember={onOpenMember} />
        ) : (
          <section key={i} className={`ai-sec ${s.kind}`}>
            <span className="ai-sec-label">{s.label}</span>
            <Markdown text={s.body} resolveMember={resolveMember} onOpenMember={onOpenMember} />
          </section>
        ),
      )}
    </div>
  )
}
