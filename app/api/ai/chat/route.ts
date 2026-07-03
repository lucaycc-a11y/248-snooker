import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/data/getConfig'
import { getVectorEngine, classifyComplexity, modelFor } from '@/lib/ai/vectorengine'
import { rateLimit, clientIp } from '@/lib/rate-limit'

// Public-facing AI chat widget backend. No admin auth — this is the site's
// contact CTA, gated only by a tight per-IP rate limit since it's
// unauthenticated and cost-bearing. Adapted from whatsapp-bot/src/ai.js's
// generateReply() system prompt, sourced from this repo's own getConfig()
// instead of the bot's separate getBotConfig() (different runtime, same
// underlying Supabase data).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  try {
    const allowed = await rateLimit('public_ai_chat', `ip:${clientIp(req)}`, 10, 600)
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
              typeof m.content === 'string'
          )
          .slice(-10)
      : []

    const config = await getConfig()

    const systemPrompt = `You are Space8's helpful assistant, replying in plain, friendly English. Keep replies under 3 sentences.

Venue facts (from the database, do not alter):
- Name: Space8
- Hours: ${config.openHour}:00–${config.closeHour === 24 ? '24' : config.closeHour}:00 daily
- Tables: 2 (Table #1, Table #2)
- Base rate: HK$${config.pricePerHour}/hour

Rules:
- Never make up information you're unsure about.
- Booking questions should be answered using the venue facts above; if unsure, suggest the visitor use the booking page on this site.
- You cannot modify a booking directly — direct the user to their member dashboard or to contact staff.`

    const complexity = classifyComplexity(userMessage)
    const vectorEngine = getVectorEngine()
    const response = await vectorEngine.messages.create({
      model: modelFor(complexity),
      max_tokens: 500,
      system: systemPrompt,
      messages: [...history, { role: 'user', content: userMessage }],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ reply: "Sorry, I can't help with that." })
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    const reply = textBlock?.text ?? "Sorry, I couldn't generate a reply — please try again."

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[ai/chat] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
