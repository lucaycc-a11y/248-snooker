'use client'

import { useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, Copy, GripVertical, Trash2 } from 'lucide-react'
import { adminTokens as tokens } from '@/lib/admin/admin-tokens'
import { plainText } from '@/lib/blog/seoCheck'

type Block = { id: string; html: string }

const KIND: Record<string, string> = {
  h2: '大標題', h3: '小標題', p: '段落', ul: '清單', ol: '編號清單', blockquote: '引言', table: '表格', figure: '圖片',
  img: '圖片', details: 'FAQ', hr: '分隔線', div: '組件', section: '區段', aside: '提示',
}

function describe(html: string): { kind: string; text: string } {
  const tag = html.match(/^<([a-z0-9]+)/i)?.[1]?.toLowerCase() ?? 'p'
  const cta = html.match(/data-s8\s*=\s*"([^"]+)"/i)?.[1]
  if (cta) return { kind: 'CTA', text: cta === 'cta-member' ? '會員行動呼籲' : cta === 'cta-booking' ? '預約行動呼籲' : '自訂行動呼籲' }
  const text = plainText(html)
  return { kind: KIND[tag] ?? tag.toUpperCase(), text: text.length > 70 ? `${text.slice(0, 70)}…` : text || (tag === 'img' ? '（圖片）' : '（空）') }
}

/** Top-level elements of an HTML fragment; stray text becomes a paragraph. */
function parseBlocks(html: string, nextId: () => string): Block[] {
  if (typeof DOMParser === 'undefined') return []
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const out: Block[] = []
  doc.body.childNodes.forEach((node) => {
    if (node instanceof Element) out.push({ id: nextId(), html: node.outerHTML })
    else if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== '') out.push({ id: nextId(), html: `<p>${(node.textContent ?? '').trim()}</p>` })
  })
  return out
}

function SortableRow({ block, index, count, onMove, onDuplicate, onRemove }: {
  block: Block; index: number; count: number
  onMove: (from: number, to: number) => void; onDuplicate: (i: number) => void; onRemove: (i: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const d = describe(block.html)
  const iconBtn = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent', color: tokens.colors.textMuted, cursor: 'pointer' } as const
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1,
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10,
        border: `1px solid ${isDragging ? tokens.colors.brand : tokens.colors.border}`, background: 'rgba(255,255,255,0.04)', listStyle: 'none',
      }}
    >
      <button type="button" aria-label="拖動排序" {...attributes} {...listeners} style={{ ...iconBtn, cursor: 'grab', touchAction: 'none' }}>
        <GripVertical size={16} aria-hidden />
      </button>
      <span style={{ flexShrink: 0, minWidth: 64, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, textAlign: 'center', background: tokens.colors.brandDim, color: tokens.colors.text }}>{d.kind}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: tokens.colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.text}</span>
      <button type="button" aria-label="上移" disabled={index === 0} onClick={() => onMove(index, index - 1)} style={{ ...iconBtn, opacity: index === 0 ? 0.3 : 1 }}><ArrowUp size={15} aria-hidden /></button>
      <button type="button" aria-label="下移" disabled={index === count - 1} onClick={() => onMove(index, index + 1)} style={{ ...iconBtn, opacity: index === count - 1 ? 0.3 : 1 }}><ArrowDown size={15} aria-hidden /></button>
      <button type="button" aria-label="複製區塊" onClick={() => onDuplicate(index)} style={iconBtn}><Copy size={15} aria-hidden /></button>
      <button type="button" aria-label="刪除區塊" onClick={() => onRemove(index)} style={{ ...iconBtn, color: tokens.colors.danger }}><Trash2 size={15} aria-hidden /></button>
    </li>
  )
}

/**
 * Drag-to-reorder view of an article's top-level blocks (headings, paragraphs, images, FAQ, CTA…).
 * Mount it with a fresh `key` whenever the HTML is changed from outside (import, snippet, Spark).
 */
export default function BlogBlocksEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const counter = useRef(0)
  const nextId = () => `b${(counter.current += 1)}`
  const [blocks, setBlocks] = useState<Block[]>(() => parseBlocks(html, nextId))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

  function commit(next: Block[]) {
    setBlocks(next)
    onChange(next.map((b) => b.html).join('\n'))
  }
  const move = (from: number, to: number) => commit(arrayMove(blocks, from, to))
  const duplicate = (i: number) => commit([...blocks.slice(0, i + 1), { id: nextId(), html: blocks[i].html }, ...blocks.slice(i + 1)])
  const remove = (i: number) => commit(blocks.filter((_, idx) => idx !== i))

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = blocks.findIndex((b) => b.id === active.id)
    const to = blocks.findIndex((b) => b.id === over.id)
    if (from >= 0 && to >= 0) move(from, to)
  }

  if (blocks.length === 0) return <p style={{ margin: 0, fontSize: 13, color: tokens.colors.textMuted }}>內容是空的，先上傳或貼上文章。</p>

  return (
    <div>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: tokens.colors.textMuted }}>拖動左邊把手，或用上下箭頭調整段落順序；改動即時套用到內容。</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {blocks.map((b, i) => (
              <SortableRow key={b.id} block={b} index={i} count={blocks.length} onMove={move} onDuplicate={duplicate} onRemove={remove} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}
