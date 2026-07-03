import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/data/getConfig'
import { getAiWidgetSettings, type AiTone } from '@/lib/data/getAiWidgetSettings'
import { getVectorEngine, classifyComplexity, modelFor, VectorEngineConfigError } from '@/lib/ai/vectorengine'
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

const HANDOFF_PREFIX = 'HANDOFF:'

const TONE_INSTRUCTIONS: Record<AiTone, string> = {
  friendly: 'Use a warm, friendly tone.',
  professional: 'Use a clear, professional tone.',
  playful: 'Use a warm, playful tone with occasional light humor.',
}

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

export async function POST(req: Request) {
  try {
    const allowed = await rateLimit('public_ai_chat', `ip:${clientIp(req)}`, 10, 600)
    if (!allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

    const body: unknown = await req.json().catch(() => null)
    if (!isRecord(body) || typeof body.message !== 'string' || !body.message.trim()) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }
    const userMessage = body.message.trim().slice(0, 1000)
    const locale = typeof body.locale === 'string' && LOCALES.includes(body.locale) ? body.locale : 'zh-HK'

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

    const [config, widgetSettings] = await Promise.all([getConfig(), getAiWidgetSettings(locale)])

    let systemPrompt = `You are Space8's helpful assistant, replying in plain, friendly English. Keep replies under 3 sentences.

Venue facts (from the database, do not alter):
- Name: Space8
- Hours: ${config.openHour}:00–${config.closeHour === 24 ? '24' : config.closeHour}:00 daily
- Tables: 2 (Table #1, Table #2)
- Base rate: HK$${config.pricePerHour}/hour

Rules:
- Never make up information you're unsure about.
- Booking questions should be answered using the venue facts above; if unsure, suggest the visitor use the booking page on this site.
- You cannot modify a booking directly — direct the user to their member dashboard or to contact staff.
- If you cannot help with the request (it's a complaint, an injury/safety issue, a legal matter, or something requiring human judgment), respond with exactly the sentinel prefix "${HANDOFF_PREFIX}" followed by one short sentence explaining why, and nothing else.

${TONE_INSTRUCTIONS[widgetSettings.tone]}`

    // Additive layer, never a replacement — per the admin settings spec.
    if (widgetSettings.systemPromptOverride) {
      systemPrompt += `\n\n${widgetSettings.systemPromptOverride}`
    }

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
    const rawReply = textBlock?.text ?? "Sorry, I couldn't generate a reply — please try again."

    if (rawReply.startsWith(HANDOFF_PREFIX)) {
      const explanation = rawReply.slice(HANDOFF_PREFIX.length).trim()
      return NextResponse.json({ reply: explanation, handoff: true })
    }

    return NextResponse.json({ reply: rawReply })
  } catch (err) {
    if (err instanceof VectorEngineConfigError) {
      console.error('[ai/chat] VectorEngine not configured')
      return NextResponse.json({ error: 'vectorengine_not_configured' }, { status: 503 })
    }
    console.error('[ai/chat] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
