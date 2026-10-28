import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { friendlyAiError, mimoChat } from '@/lib/ai/mimo'
import { LOGO_URL, newId, sanitizeDoc, type EmailDoc } from '@/lib/email-composer/doc'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const SYSTEM = `你是 Spark，由 FORM 開發的 AI 助手，替 Space8（香港預約制桌球室）設計電郵。不要提任何其他公司或模型名稱。
只輸出一個 JSON 物件，不要 markdown、不要解釋。格式：
{"subject":"電郵標題","preheader":"收件匣預覽句","footer":"頁尾小字","blocks":[ ... ]}
blocks 可用類型（每個都要有 "type"）：
- {"type":"logo"}  放在最前面
- {"type":"heading","text":"...","align":"center|left","size":26}
- {"type":"text","text":"...","align":"left|center","muted":false}  可用 \\n 換行；用 {{name}} 代表會員稱呼
- {"type":"bignumber","label":"WELCOME GIFT","value":"100","unit":"pts"}  突出一個數字或優惠
- {"type":"button","label":"...","href":"https://..."}  連結必須是 https
- {"type":"image","src":"https://...","alt":"..."}  只有用戶提供了圖片網址才可用，否則不要用 image
- {"type":"divider"} {"type":"spacer","height":24}
規則：預設用繁體廣東話書面語風格，簡短、有禮、重點清楚；不要編造價錢、優惠或日期，除非用戶提供；按鈕連結預設 https://space8.com.hk ；最多 12 個 blocks。`

function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(t.slice(start, end + 1))
  } catch {
    return null
  }
}

export const POST = withAdminSecurity(
  async (req) => {
    const body: unknown = await req.json().catch(() => null)
    const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
    const prompt = typeof b.prompt === 'string' ? b.prompt.trim().slice(0, 1500) : ''
    if (prompt.length < 4) return NextResponse.json({ error: '請描述想寫嘅電郵' }, { status: 400 })
    const current = sanitizeDoc(b.current)
    const user = current && current.blocks.length > 0
      ? `現有電郵（JSON）：\n${JSON.stringify({ subject: current.subject, preheader: current.preheader, footer: current.footer, blocks: current.blocks.map(({ id: _id, ...rest }) => rest) })}\n\n按以下要求修改並輸出完整新 JSON：\n${prompt}`
      : `請設計一封電郵：\n${prompt}`
    try {
      const out = await mimoChat({ system: SYSTEM, user, task: 'explain', maxTokens: 3000, timeoutMs: 50_000 })
      const parsed = parseJson(out.text)
      const base = current ?? null
      const doc = sanitizeDoc({
        ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
        theme: base?.theme,
      })
      if (!doc || doc.blocks.length === 0) return NextResponse.json({ error: 'Spark 未能產生有效內容，請換個說法再試' }, { status: 502 })
      // Always begin with the logo, and give every block a fresh id.
      const blocks = doc.blocks.map((x) => ({ ...x, id: newId() }))
      if (blocks[0]?.type !== 'logo') blocks.unshift({ id: newId(), type: 'logo', align: 'center', width: 140, src: LOGO_URL })
      const result: EmailDoc = { ...doc, blocks }
      return NextResponse.json({ doc: result })
    } catch (err) {
      console.error('[admin/email/generate] failed', err)
      return NextResponse.json({ error: friendlyAiError(err) }, { status: 502 })
    }
  },
  { rateLimit: { bucket: 'admin_email_generate', max: 20, windowSeconds: 3600, identifierType: 'user' } },
)
