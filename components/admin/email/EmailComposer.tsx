'use client'

/**
 * Admin email composer — block editor + raw HTML mode, live preview, Spark generation,
 * saved templates, and sending from no-reply@space8.com.hk (test / chosen members / all members).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Code2, Copy, Eye, FileText, Heading1, ImagePlus, Loader2, Minus, MousePointerClick, Palette,
  Plus, Save, Send, Smartphone, Sparkles, Monitor, Trash2, Type, X, Hash, MoveVertical, Layers,
} from 'lucide-react'
import { TemplatesView, HistoryView } from '@/components/admin/email/EmailTemplatesView'
import type { Starter } from '@/lib/email-composer/starters'
import { MemberPicker } from '@/components/spark/MemberPicker'
import type { MemberHit } from '@/lib/spark/members'
import {
  BLOCK_LABEL, defaultDoc, esc, newBlock, newId, personalise, renderDoc, sanitizeDoc,
  type Align, type EmailBlock, type EmailBlockType, type EmailDoc,
} from '@/lib/email-composer/doc'

type Template = { id: string; name: string; subject: string; doc: unknown; custom_html: string | null; updated_at: string }
type Picked = { code: string; name: string | null; email: string | null }
type Kind = 'test' | 'members' | 'all'

const BLOCK_ICON: Record<EmailBlockType, typeof Type> = {
  logo: Layers, heading: Heading1, text: Type, image: ImagePlus, button: MousePointerClick, divider: Minus, spacer: MoveVertical, bignumber: Hash,
}
const PALETTE: EmailBlockType[] = ['heading', 'text', 'image', 'button', 'bignumber', 'logo', 'divider', 'spacer']

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number; data?: unknown }> {
  try {
    const res = await fetch(url, init)
    const data: unknown = await res.json().catch(() => null)
    if (!res.ok) {
      const msg = typeof data === 'object' && data !== null && 'error' in data ? String((data as { error: unknown }).error) : '操作失敗'
      return { ok: false, error: msg, status: res.status, data }
    }
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: '網絡錯誤，請再試', status: 0 }
  }
}

function summary(b: EmailBlock): string {
  switch (b.type) {
    case 'heading': case 'text': return b.text.replace(/\s+/g, ' ').slice(0, 36) || '（空）'
    case 'button': return b.label || '（按鈕）'
    case 'image': return b.src ? '已加圖片' : '未揀圖片'
    case 'bignumber': return `${b.value}${b.unit}`
    case 'spacer': return `${b.height}px`
    default: return ''
  }
}

function AlignPick({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  const opts: [Align, typeof AlignLeft][] = [['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]]
  return (
    <div className="em-seg" role="group" aria-label="對齊">
      {opts.map(([a, Icon]) => (
        <button key={a} type="button" className={value === a ? 'on' : undefined} aria-pressed={value === a} onClick={() => onChange(a)}><Icon size={16} aria-hidden /></button>
      ))}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="em-field"><span>{label}</span>{children}</label>
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="em-field em-color">
      <span>{label}</span>
      <span className="em-color-in">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
        <input type="text" value={value} maxLength={7} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && onChange(e.target.value)} />
      </span>
    </label>
  )
}

export default function EmailComposer({ adminEmail }: { adminEmail: string }) {
  const [doc, setDoc] = useState<EmailDoc>(() => defaultDoc())
  const [customHtml, setCustomHtml] = useState<string | null>(null)
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const [selected, setSelected] = useState<string>('theme')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [templates, setTemplates] = useState<Template[]>([])
  const [tplId, setTplId] = useState<string | null>(null)
  const [tplName, setTplName] = useState('')
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState<null | 'save' | 'gen' | 'upload'>(null)
  const [prompt, setPrompt] = useState('')
  const [useCurrent, setUseCurrent] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [view, setView] = useState<'compose' | 'templates' | 'history'>('compose')
  const fileRef = useRef<HTMLInputElement>(null)
  const [autoAt, setAutoAt] = useState<Date | null>(null)
  const [autoErr, setAutoErr] = useState(false)
  const snap = useRef<string | null>(null)
  const justLoaded = useRef(true)
  const saving = useRef(false)
  const uploadTarget = useRef<string | null>(null)

  const say = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text })
    window.setTimeout(() => setToast((t) => (t && t.text === text ? null : t)), 4500)
  }, [])

  const loadTemplates = useCallback(async () => {
    const r = await api<{ templates: Template[] }>('/api/admin/email/templates')
    if (r.ok) setTemplates(r.data.templates)
  }, [])
  useEffect(() => { void loadTemplates() }, [loadTemplates])

  const html = useMemo(() => customHtml ?? renderDoc(doc), [customHtml, doc])
  const previewHtml = useMemo(() => personalise(html, { name: 'Luca' }), [html])
  const block = doc.blocks.find((b) => b.id === selected) ?? null
  const locked = customHtml !== null

  const patchDoc = (p: Partial<EmailDoc>) => setDoc((d) => ({ ...d, ...p }))
  const patchTheme = (p: Partial<EmailDoc['theme']>) => setDoc((d) => ({ ...d, theme: { ...d.theme, ...p } }))
  const patchBlock = (id: string, p: Partial<EmailBlock>) =>
    setDoc((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...p } as EmailBlock) : b)) }))
  const addBlock = (t: EmailBlockType) => {
    const b = newBlock(t)
    setDoc((d) => {
      const at = d.blocks.findIndex((x) => x.id === selected)
      const blocks = [...d.blocks]
      blocks.splice(at >= 0 ? at + 1 : blocks.length, 0, b)
      return { ...d, blocks }
    })
    setSelected(b.id)
  }
  const move = (id: string, dir: -1 | 1) =>
    setDoc((d) => {
      const i = d.blocks.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.blocks.length) return d
      const blocks = [...d.blocks]
      ;[blocks[i], blocks[j]] = [blocks[j], blocks[i]]
      return { ...d, blocks }
    })
  const remove = (id: string) => { setDoc((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) })); setSelected('theme') }
  const duplicate = (id: string) =>
    setDoc((d) => {
      const i = d.blocks.findIndex((b) => b.id === id)
      if (i < 0) return d
      const copy = { ...d.blocks[i], id: newId() } as EmailBlock
      const blocks = [...d.blocks]
      blocks.splice(i + 1, 0, copy)
      return { ...d, blocks }
    })

  async function upload(file: File): Promise<string | null> {
    setBusy('upload')
    const fd = new FormData()
    fd.append('file', file)
    const r = await api<{ url: string }>('/api/admin/email/upload-image', { method: 'POST', body: fd })
    setBusy(null)
    if (!r.ok) { say('err', r.error); return null }
    return r.data.url
  }
  const pickImage = (id: string) => { uploadTarget.current = id; fileRef.current?.click() }
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    const id = uploadTarget.current
    if (!f || !id) return
    const url = await upload(f)
    if (url) patchBlock(id, { src: url } as Partial<EmailBlock>)
  }

  async function generate() {
    setBusy('gen')
    const r = await api<{ doc: unknown }>('/api/admin/email/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, current: useCurrent ? doc : undefined }),
    })
    setBusy(null)
    if (!r.ok) { say('err', r.error); return }
    const next = sanitizeDoc(r.data.doc)
    if (!next) { say('err', 'Spark 產生嘅內容無法使用'); return }
    setCustomHtml(null); setMode('visual'); setDoc(next); setSelected('theme'); setUseCurrent(true)
    say('ok', 'Spark 已產生電郵，可以繼續修改')
  }

  const persist = useCallback(async (silent: boolean): Promise<boolean> => {
    const name = (tplName || doc.subject).trim()
    if (!name) { if (!silent) say('err', '請填寫範本名稱'); return false }
    if (saving.current) return false
    saving.current = true
    if (!silent) setBusy('save')
    const r = await api<{ id: string }>('/api/admin/email/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: tplId ?? undefined, name, doc, customHtml }),
    })
    saving.current = false
    if (!silent) setBusy(null)
    if (!r.ok) { if (silent) setAutoErr(true); else say('err', r.error); return false }
    snap.current = JSON.stringify([doc, customHtml, tplName || name])
    setTplId(r.data.id); if (!tplName) setTplName(name)
    setAutoErr(false); setAutoAt(new Date())
    if (!silent) say('ok', '範本已儲存')
    void loadTemplates()
    return true
  }, [tplName, doc, customHtml, tplId, say, loadTemplates])
  const saveTemplate = () => persist(false)

  // Auto-save: 2s after the last edit, silently, into the current template (created on first edit).
  useEffect(() => {
    const now = JSON.stringify([doc, customHtml, tplName])
    if (justLoaded.current) { justLoaded.current = false; snap.current = now; return }
    if (snap.current === now) return
    const timer = window.setTimeout(() => { void persist(true) }, 2000)
    return () => window.clearTimeout(timer)
  }, [doc, customHtml, tplName, persist])

  function loadTemplate(t: Template) {
    const d = sanitizeDoc(t.doc)
    if (!d) { say('err', '範本內容已損壞'); return }
    justLoaded.current = true; setAutoAt(null)
    setDoc(d); setCustomHtml(t.custom_html); setMode(t.custom_html ? 'html' : 'visual'); setTplId(t.id); setTplName(t.name); setSelected('theme'); setView('compose')
  }
  async function deleteTemplate(t: Template) {
    if (!window.confirm(`刪除範本「${t.name}」？`)) return
    const r = await api<{ ok: boolean }>(`/api/admin/email/templates/${t.id}`, { method: 'DELETE' })
    if (!r.ok) { say('err', r.error); return }
    if (tplId === t.id) { setTplId(null) }
    void loadTemplates()
  }
  function newDoc() {
    if (!window.confirm('開新電郵？目前未儲存嘅內容會消失。')) return
    justLoaded.current = true; setAutoAt(null)
    setDoc(defaultDoc()); setCustomHtml(null); setMode('visual'); setTplId(null); setTplName(''); setSelected('theme')
  }
  function openStarter(st: Starter) {
    justLoaded.current = true; setAutoAt(null)
    setDoc(st.doc()); setCustomHtml(null); setMode('visual'); setTplId(null); setTplName(st.name); setSelected('theme'); setView('compose')
  }
  function startBlank() {
    justLoaded.current = true; setAutoAt(null)
    setDoc(defaultDoc()); setCustomHtml(null); setMode('visual'); setTplId(null); setTplName(''); setSelected('theme'); setView('compose')
  }
  function toHtmlMode() { if (customHtml === null) setCustomHtml(renderDoc(doc)); setMode('html') }
  function backToBlocks() {
    if (customHtml !== null && !window.confirm('返回積木編輯會捨棄 HTML 嘅修改，確定？')) return
    setCustomHtml(null); setMode('visual')
  }

  return (
    <div className="em-app">
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={onFile} />

      <nav className="em-views" aria-label="電郵">
        {([['compose', '撰寫'], ['templates', '範本'], ['history', '發送記錄']] as const).map(([k, label]) => (
          <button key={k} type="button" className={view === k ? 'on' : undefined} aria-current={view === k ? 'page' : undefined} onClick={() => setView(k)}>{label}</button>
        ))}
      </nav>

      {view === 'templates' ? (
        <TemplatesView templates={templates} onOpen={loadTemplate} onStarter={openStarter} onDelete={(t) => void deleteTemplate(t)} onNew={startBlank} />
      ) : null}
      {view === 'history' ? <HistoryView /> : null}
      {view === 'compose' ? (<>
      <header className="em-bar">
        <div className="em-bar-l">
          <input className="em-subject" value={doc.subject} onChange={(e) => patchDoc({ subject: e.target.value })} placeholder="電郵標題" aria-label="電郵標題" maxLength={150} />
        </div>
        <div className="em-bar-r">
          <div className="em-seg" role="group" aria-label="編輯模式">
            <button type="button" className={mode === 'visual' ? 'on' : undefined} onClick={() => (locked ? backToBlocks() : setMode('visual'))}><Palette size={15} aria-hidden /> 積木</button>
            <button type="button" className={mode === 'html' ? 'on' : undefined} onClick={toHtmlMode}><Code2 size={15} aria-hidden /> HTML</button>
          </div>
          <span className={`em-auto${autoErr ? ' err' : ''}`} aria-live="polite">{autoErr ? '自動儲存失敗' : autoAt ? `已自動儲存 ${autoAt.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
          <button type="button" className="admin-pill-btn" onClick={() => void saveTemplate()} disabled={busy === 'save'}>
            {busy === 'save' ? <Loader2 size={15} className="sp-spin" aria-hidden /> : <Save size={15} aria-hidden />} 儲存
          </button>
          <button type="button" className="admin-pill-btn primary" onClick={() => setSendOpen(true)}><Send size={15} aria-hidden /> 發送</button>
        </div>
      </header>

      <div className="em-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={pane === 'edit'} className={pane === 'edit' ? 'on' : undefined} onClick={() => setPane('edit')}>編輯</button>
        <button type="button" role="tab" aria-selected={pane === 'preview'} className={pane === 'preview' ? 'on' : undefined} onClick={() => setPane('preview')}>預覽</button>
      </div>

      <div className={`em-body pane-${pane}`}>
        {/* ── left: Spark, blocks, templates ───────────────────────────── */}
        <aside className="em-left">
          <section className="em-box em-spark">
            <h3><Sparkles size={15} aria-hidden /> Spark 幫你寫</h3>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} maxLength={1500} placeholder="例如：歡迎新會員，送 100 分，邀請佢第一次預約" />
            <label className="em-check"><input type="checkbox" checked={useCurrent} onChange={(e) => setUseCurrent(e.target.checked)} /> 按現有內容修改</label>
            <button type="button" className="admin-pill-btn primary" onClick={() => void generate()} disabled={busy === 'gen' || prompt.trim().length < 4}>
              {busy === 'gen' ? <><Loader2 size={15} className="sp-spin" aria-hidden /> 產生中…</> : <><Sparkles size={15} aria-hidden /> 產生</>}
            </button>
          </section>

          <section className="em-box">
            <h3>內容積木</h3>
            {locked ? <p className="em-note">已使用自訂 HTML，積木編輯已停用。</p> : null}
            <ol className="em-blocks">
              <li>
                <button type="button" className={`em-blk${selected === 'theme' ? ' on' : ''}`} onClick={() => setSelected('theme')}><Palette size={16} aria-hidden /><b>整體樣式</b></button>
              </li>
              {doc.blocks.map((b, i) => {
                const Icon = BLOCK_ICON[b.type]
                return (
                  <li key={b.id}>
                    <button type="button" className={`em-blk${selected === b.id ? ' on' : ''}`} onClick={() => setSelected(b.id)} disabled={locked}>
                      <Icon size={16} aria-hidden /><b>{BLOCK_LABEL[b.type]}</b><small>{summary(b)}</small>
                    </button>
                    {selected === b.id && !locked ? (
                      <span className="em-blk-tools">
                        <button type="button" aria-label="上移" onClick={() => move(b.id, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                        <button type="button" aria-label="下移" onClick={() => move(b.id, 1)} disabled={i === doc.blocks.length - 1}><ArrowDown size={14} /></button>
                        <button type="button" aria-label="複製" onClick={() => duplicate(b.id)}><Copy size={14} /></button>
                        <button type="button" aria-label="刪除" onClick={() => remove(b.id)}><Trash2 size={14} /></button>
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ol>
            <div className="em-palette" aria-label="加積木">
              {PALETTE.map((t) => {
                const Icon = BLOCK_ICON[t]
                return <button key={t} type="button" onClick={() => addBlock(t)} disabled={locked || doc.blocks.length >= 40}><Icon size={15} aria-hidden /><span>{BLOCK_LABEL[t]}</span><Plus size={13} aria-hidden /></button>
              })}
            </div>
          </section>

          <section className="em-box">
            <h3><FileText size={15} aria-hidden /> 範本</h3>
            <div className="em-tpl-name">
              <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="範本名稱" maxLength={80} aria-label="範本名稱" />
              <button type="button" className="admin-pill-btn" onClick={newDoc}>新電郵</button>
            </div>
            {templates.length === 0 ? <p className="em-note">未有儲存嘅範本。</p> : (
              <ul className="em-tpls">
                {templates.map((t) => (
                  <li key={t.id} className={t.id === tplId ? 'on' : undefined}>
                    <button type="button" onClick={() => loadTemplate(t)}><b>{t.name}</b><small>{t.subject}</small></button>
                    <button type="button" className="em-x" aria-label="刪除範本" onClick={() => void deleteTemplate(t)}><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* ── centre: preview / HTML ───────────────────────────────────── */}
        <main className="em-center">
          {mode === 'html' ? (
            <div className="em-code">
              <div className="em-code-bar">
                <span>HTML 原始碼</span>
                <small>可用 {'{{name}}'} 代表會員稱呼（BCC 發送時顯示為「會員」）。script、form、iframe 會在發送時移除。</small>
              </div>
              <textarea spellCheck={false} value={customHtml ?? renderDoc(doc)} onChange={(e) => setCustomHtml(e.target.value)} aria-label="HTML 原始碼" />
              <div className="em-code-prev"><iframe title="預覽" sandbox="" srcDoc={previewHtml} /></div>
            </div>
          ) : (
            <div className="em-stage">
              <div className="em-stage-bar">
                <span><Eye size={15} aria-hidden /> 預覽</span>
                <div className="em-seg" role="group" aria-label="裝置">
                  <button type="button" className={device === 'desktop' ? 'on' : undefined} onClick={() => setDevice('desktop')} aria-label="電腦"><Monitor size={15} /></button>
                  <button type="button" className={device === 'mobile' ? 'on' : undefined} onClick={() => setDevice('mobile')} aria-label="手機"><Smartphone size={15} /></button>
                </div>
              </div>
              <div className={`em-frame ${device}`}><iframe title="預覽" sandbox="" srcDoc={previewHtml} /></div>
            </div>
          )}
        </main>

        {/* ── right: properties ────────────────────────────────────────── */}
        <aside className="em-right">
          {selected === 'theme' || !block ? (
            <section className="em-box">
              <h3><Palette size={15} aria-hidden /> 整體樣式</h3>
              <Field label="收件匣預覽句"><input value={doc.preheader} maxLength={200} onChange={(e) => patchDoc({ preheader: e.target.value })} placeholder="顯示喺標題旁邊嘅一句" /></Field>
              <Color label="頁面背景" value={doc.theme.pageBg} onChange={(v) => patchTheme({ pageBg: v })} />
              <Color label="卡片背景" value={doc.theme.cardBg} onChange={(v) => patchTheme({ cardBg: v })} />
              <Color label="卡片邊框" value={doc.theme.cardBorder} onChange={(v) => patchTheme({ cardBorder: v })} />
              <Color label="文字" value={doc.theme.text} onChange={(v) => patchTheme({ text: v })} />
              <Color label="次要文字" value={doc.theme.muted} onChange={(v) => patchTheme({ muted: v })} />
              <Color label="強調色／按鈕" value={doc.theme.accent} onChange={(v) => patchTheme({ accent: v })} />
              <Color label="按鈕文字" value={doc.theme.buttonText} onChange={(v) => patchTheme({ buttonText: v })} />
              <Field label={`卡片闊度 ${doc.theme.width}px`}><input type="range" min={360} max={680} step={10} value={doc.theme.width} onChange={(e) => patchTheme({ width: Number(e.target.value) })} /></Field>
              <Field label={`圓角 ${doc.theme.radius}px`}><input type="range" min={0} max={40} value={doc.theme.radius} onChange={(e) => patchTheme({ radius: Number(e.target.value) })} /></Field>
              <Field label="頁尾文字"><textarea rows={3} maxLength={400} value={doc.footer} onChange={(e) => patchDoc({ footer: e.target.value })} /></Field>
              <div className="em-presets">
                <button type="button" onClick={() => patchTheme({ pageBg: '#000000', cardBg: '#0a0a0a', cardBorder: '#1f1f1f', text: '#ffffff', muted: '#a3a3a3', accent: '#22c55e', buttonText: '#000000' })}>深色（預設）</button>
                <button type="button" onClick={() => patchTheme({ pageBg: '#f3f4f2', cardBg: '#ffffff', cardBorder: '#e5e7e4', text: '#111111', muted: '#6b7280', accent: '#14532d', buttonText: '#ffffff' })}>淺色</button>
              </div>
            </section>
          ) : (
            <section className="em-box">
              <h3>{BLOCK_LABEL[block.type]}</h3>
              {block.type === 'heading' ? (<>
                <Field label="文字"><textarea rows={2} value={block.text} maxLength={200} onChange={(e) => patchBlock(block.id, { text: e.target.value })} /></Field>
                <Field label={`字體大小 ${block.size}px`}><input type="range" min={14} max={56} value={block.size} onChange={(e) => patchBlock(block.id, { size: Number(e.target.value) })} /></Field>
                <AlignPick value={block.align} onChange={(a) => patchBlock(block.id, { align: a })} />
              </>) : null}
              {block.type === 'text' ? (<>
                <Field label="文字"><textarea rows={7} value={block.text} maxLength={4000} onChange={(e) => patchBlock(block.id, { text: e.target.value })} /></Field>
                <label className="em-check"><input type="checkbox" checked={block.muted} onChange={(e) => patchBlock(block.id, { muted: e.target.checked })} /> 次要顏色</label>
                <AlignPick value={block.align} onChange={(a) => patchBlock(block.id, { align: a })} />
                <p className="em-note">{'{{name}}'} 會變成會員嘅名稱（測試會用你嘅名；正式 BCC 發送時顯示為「會員」）。</p>
              </>) : null}
              {block.type === 'button' ? (<>
                <Field label="按鈕文字"><input value={block.label} maxLength={80} onChange={(e) => patchBlock(block.id, { label: e.target.value })} /></Field>
                <Field label="連結（https://）"><input value={block.href} maxLength={500} onChange={(e) => patchBlock(block.id, { href: e.target.value })} placeholder="https://space8.com.hk" /></Field>
                <AlignPick value={block.align} onChange={(a) => patchBlock(block.id, { align: a })} />
              </>) : null}
              {block.type === 'image' ? (<>
                {block.src ? <img className="em-thumb" src={block.src} alt="" /> : null}
                <button type="button" className="admin-pill-btn" onClick={() => pickImage(block.id)} disabled={busy === 'upload'}>
                  {busy === 'upload' ? <Loader2 size={15} className="sp-spin" aria-hidden /> : <ImagePlus size={15} aria-hidden />} 上載圖片
                </button>
                <Field label="或貼圖片網址（https://）"><input value={block.src} maxLength={1000} onChange={(e) => patchBlock(block.id, { src: e.target.value })} placeholder="https://…" /></Field>
                <Field label="替代文字"><input value={block.alt} maxLength={200} onChange={(e) => patchBlock(block.id, { alt: e.target.value })} /></Field>
                <Field label="點擊連結（可留空）"><input value={block.link} maxLength={500} onChange={(e) => patchBlock(block.id, { link: e.target.value })} placeholder="https://…" /></Field>
                <Field label={`圓角 ${block.radius}px`}><input type="range" min={0} max={40} value={block.radius} onChange={(e) => patchBlock(block.id, { radius: Number(e.target.value) })} /></Field>
              </>) : null}
              {block.type === 'logo' ? (<>
                {block.src ? <img className="em-thumb logo" src={block.src} alt="" /> : null}
                <Field label={`闊度 ${block.width}px`}><input type="range" min={60} max={320} value={block.width} onChange={(e) => patchBlock(block.id, { width: Number(e.target.value) })} /></Field>
                <AlignPick value={block.align} onChange={(a) => patchBlock(block.id, { align: a })} />
                <button type="button" className="admin-pill-btn" onClick={() => pickImage(block.id)} disabled={busy === 'upload'}><ImagePlus size={15} aria-hidden /> 換成其他 Logo</button>
                <p className="em-note">預設係 Space8 Logo。</p>
              </>) : null}
              {block.type === 'bignumber' ? (<>
                <Field label="小標題"><input value={block.label} maxLength={60} onChange={(e) => patchBlock(block.id, { label: e.target.value })} /></Field>
                <Field label="數字"><input value={block.value} maxLength={20} onChange={(e) => patchBlock(block.id, { value: e.target.value })} /></Field>
                <Field label="單位"><input value={block.unit} maxLength={12} onChange={(e) => patchBlock(block.id, { unit: e.target.value })} /></Field>
              </>) : null}
              {block.type === 'spacer' ? (
                <Field label={`高度 ${block.height}px`}><input type="range" min={4} max={120} value={block.height} onChange={(e) => patchBlock(block.id, { height: Number(e.target.value) })} /></Field>
              ) : null}
              {block.type === 'divider' ? <p className="em-note">分隔線冇其他設定。</p> : null}
            </section>
          )}
        </aside>
      </div>

      </>) : null}

      {toast ? <div className={`em-toast ${toast.kind}`} role="status">{toast.text}</div> : null}
      {sendOpen ? (
        <SendDialog
          adminEmail={adminEmail}
          subject={doc.subject}
          doc={doc}
          customHtml={customHtml}
          html={html}
          templateId={tplId}
          onClose={() => setSendOpen(false)}
          onDone={(m) => { setSendOpen(false); say('ok', m) }}
        />
      ) : null}
    </div>
  )
}

// ── send dialog ───────────────────────────────────────────────────────────────────────────────
function SendDialog(props: {
  adminEmail: string; subject: string; doc: EmailDoc; customHtml: string | null; html: string; templateId: string | null
  onClose: () => void; onDone: (msg: string) => void
}) {
  const [kind, setKind] = useState<Kind>('test')
  const [picked, setPicked] = useState<Picked[]>([])
  const [count, setCount] = useState<number | null>(null)
  const [countErr, setCountErr] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [ack, setAck] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const codes = picked.map((p) => p.code)
  const [sug, setSug] = useState<{ kind: Kind; reason: string; checks: string[] } | null>(null)
  const [sugBusy, setSugBusy] = useState(true)

  useEffect(() => {
    let alive = true
    void api<{ kind: Kind; reason: string; checks: string[] }>('/api/admin/email/suggest', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: props.subject, html: props.html }),
    }).then((r) => { if (!alive) return; if (r.ok) setSug(r.data); setSugBusy(false) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let alive = true
    setCount(null); setCountErr(null)
    if (kind === 'members' && codes.length === 0) { setCount(0); return }
    const q = new URLSearchParams({ kind, codes: codes.join(',') })
    void api<{ count: number }>(`/api/admin/email/audience?${q.toString()}`).then((r) => {
      if (!alive) return
      if (r.ok) setCount(r.data.count)
      else setCountErr(r.error)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, codes.join(',')])

  const needsConfirm = kind === 'all'
  const ready =
    props.subject.trim() !== '' && count !== null && count > 0 && !sending &&
    (!needsConfirm || (ack && typed.trim() === String(count)))

  async function send() {
    setSending(true); setError(null)
    const r = await api<{ sent: number; failed: number; total: number }>('/api/admin/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, codes, subject: props.subject, doc: props.doc, customHtml: props.customHtml, templateId: props.templateId, confirmCount: kind === 'all' ? count : undefined }),
    })
    setSending(false)
    if (!r.ok) { setError(r.error); return }
    props.onDone(`已發送 ${r.data.sent} 封${r.data.failed > 0 ? `，${r.data.failed} 封失敗` : ''}（寄件人 no-reply@space8.com.hk）`)
  }

  return (
    <div className="em-modal" role="dialog" aria-modal="true" aria-label="發送電郵">
      <button type="button" className="em-scrim" aria-label="關閉" onClick={props.onClose} />
      <div className="em-dialog">
        <header><h2>發送電郵</h2><button type="button" className="ad-icon-btn" aria-label="關閉" onClick={props.onClose}><X size={18} /></button></header>
        <p className="em-from">寄件人：<b>Space8 &lt;no-reply@space8.com.hk&gt;</b></p>
        <p className="em-from">方式：<b>{kind === 'test' ? '直接發送' : 'BCC 密件副本（收件人互相睇唔到）'}</b></p>
        <p className="em-from">標題：<b>{props.subject || '（未填寫）'}</b></p>

        <div className="em-suggest" aria-live="polite">
          <b><Sparkles size={14} aria-hidden /> Spark 建議</b>
          {sugBusy ? <p className="em-note"><Loader2 size={13} className="sp-spin" aria-hidden /> 分析電郵內容…</p> : sug ? (<>
            <p>建議：<b>{sug.kind === 'test' ? '先發測試' : sug.kind === 'members' ? '發俾指定會員' : '發俾全部會員（先完成測試）'}</b>。{sug.reason}</p>
            {sug.checks.length > 0 ? <ul>{sug.checks.map((c, i) => <li key={i}>{c}</li>)}</ul> : null}
            {sug.kind !== kind ? <button type="button" className="admin-pill-btn" onClick={() => setKind(sug.kind)}>採用建議</button> : null}
          </>) : <p className="em-note">暫時未能提供建議。</p>}
        </div>

        <div className="em-kinds" role="radiogroup" aria-label="收件人">
          {([['test', '測試', `只發俾自己（${props.adminEmail}）`], ['members', '揀會員', '指定會員'], ['all', '全部會員', '不包括黑名單、已刪除同隱藏／測試帳戶']] as [Kind, string, string][]).map(([k, t, d]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? 'on' : undefined} onClick={() => setKind(k)}><b>{t}</b><small>{d}</small></button>
          ))}
        </div>

        {kind === 'members' ? (
          <div className="em-members">
            {picked.length > 0 ? (
              <ul className="em-chips">
                {picked.map((p) => (
                  <li key={p.code}>{p.name ?? p.code}<button type="button" aria-label="移除" onClick={() => setPicked((x) => x.filter((y) => y.code !== p.code))}><X size={12} /></button></li>
                ))}
              </ul>
            ) : null}
            <MemberPicker autoFocus={false} onPick={(m: MemberHit) => setPicked((x) => (x.some((y) => y.code === m.code) ? x : [...x, { code: m.code, name: m.name, email: m.email }]))} />
          </div>
        ) : null}

        <p className="em-count">{countErr ? <span className="err">{countErr}</span> : count === null ? '計算收件人…' : <>會寄給 <b>{count}</b> 人</>}</p>

        {needsConfirm ? (
          <div className="em-confirm">
            <label className="em-check"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> 我已預覽並核對內容，確認會發送畀全部會員</label>
            <label className="em-field"><span>請輸入人數 {count ?? ''} 確認</span><input inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} /></label>
            <p className="em-note">宣傳類電郵請確保內容合法，並提供退訂方法（頁尾可寫「如不想收到此類電郵，請回覆此信」）。</p>
          </div>
        ) : null}

        {error ? <p className="em-err" role="alert">{error}</p> : null}
        <footer>
          <button type="button" className="admin-pill-btn" onClick={props.onClose}>取消</button>
          <button type="button" className="admin-pill-btn primary" onClick={() => void send()} disabled={!ready}>
            {sending ? <><Loader2 size={15} className="sp-spin" aria-hidden /> 發送中…</> : <><Send size={15} aria-hidden /> {kind === 'test' ? '發送測試' : `發送給 ${count ?? 0} 人`}</>}
          </button>
        </footer>
      </div>
    </div>
  )
}

// Silence the unused import warning for helpers kept for future use.
void esc
