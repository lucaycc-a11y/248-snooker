import { NextResponse } from 'next/server'
import { withAdminSecurity } from '@/lib/security/admin-wrapper'
import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { runSpark, type SparkBlock, type SparkEvent, type SparkStep } from '@/lib/spark/agent'
import { hkDayStartIso } from '@/lib/spark/limits'

// Spark chat — one admin message in, a stream of events out (steps, cards, text).
// Spark can only PROPOSE changes here; they run from /api/admin/spark/actions/[id].

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_MESSAGE = 2000
const DAILY_MESSAGES = 150

const asRec = (v: unknown): Record<string, unknown> => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export const POST = withAdminSecurity(
  async (req, admin) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: '資料格式不正確' }, { status: 400 })
    }
    const f = asRec(body)
    const message = typeof f.message === 'string' ? f.message.replace(/\u0000/g, '').trim().slice(0, MAX_MESSAGE) : ''
    if (message.length < 1) return NextResponse.json({ error: '請輸入訊息' }, { status: 400 })
    if (!process.env.MIMO_API_KEY) return NextResponse.json({ error: 'Spark 暫時未能使用：伺服器尚未設定 AI 服務金鑰。' }, { status: 503 })

    const email = admin.email ?? 'unknown'
    const svc = getLegacyServiceSupabase()

    // Daily cap across all of this admin's chats.
    const { data: mine } = await svc.from('admin_spark_chats').select('id').eq('admin_user_id', admin.id).limit(500)
    const mineIds = ((mine ?? []) as { id: string }[]).map((c) => c.id)
    if (mineIds.length > 0) {
      const { count } = await svc
        .from('admin_spark_messages')
        .select('id', { count: 'exact', head: true })
        .in('chat_id', mineIds)
        .eq('role', 'user')
        .gte('created_at', hkDayStartIso())
      if ((count ?? 0) >= DAILY_MESSAGES) return NextResponse.json({ error: `今日訊息已達上限（${DAILY_MESSAGES} 則），明日再試` }, { status: 429 })
    }

    // Chat: continue an owned one or start a new one.
    let chatId = typeof f.chatId === 'string' ? f.chatId : null
    if (chatId) {
      const { data: c } = await svc.from('admin_spark_chats').select('id').eq('id', chatId).eq('admin_user_id', admin.id).maybeSingle()
      if (!c) return NextResponse.json({ error: '找不到這個對話' }, { status: 404 })
    } else {
      const { data: c, error } = await svc
        .from('admin_spark_chats')
        .insert({ admin_user_id: admin.id, admin_email: email, title: message.replace(/\s+/g, ' ').slice(0, 30) })
        .select('id')
        .single()
      if (error || !c) return NextResponse.json({ error: '無法建立對話' }, { status: 500 })
      chatId = String((c as { id: string }).id)
    }

    const { data: prev } = await svc.from('admin_spark_messages').select('role, content').eq('chat_id', chatId).order('created_at', { ascending: false }).limit(14)
    const history = ((prev ?? []) as { role: string; content: string }[])
      .reverse()
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim() !== '')
      .map((m) => ({ role: m.role === 'user' ? ('user' as const) : ('assistant' as const), content: m.content }))

    await svc.from('admin_spark_messages').insert({ chat_id: chatId, role: 'user', content: message })
    const { data: placeholder } = await svc.from('admin_spark_messages').insert({ chat_id: chatId, role: 'assistant', content: '' }).select('id').single()
    const messageId = placeholder ? String((placeholder as { id: string }).id) : null
    const cid = chatId

    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (e: SparkEvent | { type: 'meta'; chatId: string } | { type: 'done'; chatId: string }): void => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
          } catch {
            /* client went away; keep working so the proposal and transcript are still saved */
          }
        }
        const blocks: SparkBlock[] = []
        const steps = new Map<string, SparkStep>()
        send({ type: 'meta', chatId: cid })

        const result = await runSpark({
          history,
          prompt: message,
          ctx: { adminId: admin.id, adminEmail: email, chatId: cid, messageId },
          emit: (e) => {
            if (e.type === 'block') blocks.push(e.block)
            if (e.type === 'step') steps.set(e.step.id, e.step)
            send(e)
          },
        })

        const text = result.text ?? ''
        if (result.error) send({ type: 'error', message: result.error })
        else send({ type: 'text', text })

        if (messageId) {
          await svc
            .from('admin_spark_messages')
            .update({ content: result.error ?? text, blocks, steps: [...steps.values()] })
            .eq('id', messageId)
        }
        await svc.from('admin_spark_chats').update({ updated_at: new Date().toISOString() }).eq('id', cid)
        send({ type: 'done', chatId: cid })
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      },
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
    })
  },
  { rateLimit: { bucket: 'admin_spark_chat', max: 20, windowSeconds: 60, identifierType: 'user' } },
)
