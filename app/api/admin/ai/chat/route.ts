import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminStats, getRevenueSeries, getLiveOccupancy } from '@/lib/data/getAdminStats'
import { getVectorEngine, VectorEngineConfigError } from '@/lib/ai/vectorengine'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Persistent admin AI panel backend — conversational, unlike the one-shot
// /api/admin/ai/summary button. Auth-gated (admin session required); rate
// limited per-admin on top of that since a chat panel invites many more
// calls per session than a single summary click.
//
// No tool-use loop (yet): every turn gets the same snapshot of stats/revenue/
// occupancy as background context, same technique as the summary route. This
// covers "how many bookings today", "why did revenue drop Tuesday" etc.
// without the complexity of a full tool-call loop — add tools later if the
// model needs to drill into individual bookings.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const allowed = await rateLimit('admin_ai_chat', `user:${admin.userId}`, 30, 300)
    if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const userMessage = body.message.trim().slice(0, 1000)
    const history: ChatMessage[] = Array.isArray(body.history)
      ? (body.history as unknown[])
          .filter(
            (m): m is ChatMessage =>
              isRecord(m) &&
              (m.role === 'user' || m.role === 'assistant') &&
              typeof m.content === 'string',
          )
          .slice(-10)
      : []

    const [stats, revenue, occupancy] = await Promise.all([
      getAdminStats(),
      getRevenueSeries(30),
      getLiveOccupancy(),
    ])

    const vectorEngine = getVectorEngine()
    const response = await vectorEngine.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `You are an internal analyst for a snooker club's admin dashboard. Answer the admin's questions about business performance using ONLY the data provided below — never invent numbers. If the data doesn't cover their question, say so plainly instead of guessing. Be direct and concise; use **bold** for key numbers and "- " bullet lines when listing multiple points, plain prose otherwise.

Today's stats: ${JSON.stringify(stats)}
Live table occupancy: ${JSON.stringify(occupancy)}
Last 30 days revenue/bookings by day: ${JSON.stringify(revenue)}`,
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: userMessage },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ reply: 'Unable to answer that one.' })
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    return NextResponse.json({ reply: textBlock?.text ?? "Sorry, I couldn't reply — please try again." })
  } catch (err) {
    if (err instanceof VectorEngineConfigError) {
      console.error('[admin/ai/chat] VectorEngine not configured')
      return NextResponse.json({ error: 'vectorengine_not_configured' }, { status: 503 })
    }
    console.error('[admin/ai/chat] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
