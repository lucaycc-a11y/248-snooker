import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/data/getConfig'
import { getAiWidgetSettings, type AiTone } from '@/lib/data/getAiWidgetSettings'
import { getVectorEngine, classifyComplexity, modelFor, VectorEngineConfigError } from '@/lib/ai/vectorengine'
import { buildToolContext, toolDefinitions, runTool } from '@/lib/ai/tools'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import type Anthropic from '@anthropic-ai/sdk'

// Public-facing AI chat widget backend. No admin auth required to use the
// widget itself — it's the site's contact CTA, gated only by a tight per-IP
// rate limit. Admin-only tools (see lib/ai/tools.ts) still individually check
// the caller's admin session before doing anything, so an anonymous visitor
// simply never gets those tools offered to the model in the first place.
//
// Tool-use loop: the model can call read-only info tools (available to
// anyone) and, for logged-in admins browsing with the widget, an admin CMS
// draft-proposal tool. Adapted from whatsapp-bot/src/ai.js's generateReply()
// system prompt, sourced from this repo's own getConfig() instead of the
// bot's separate getBotConfig().

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type ChatMessage = { role: 'user' | 'assistant'; content: string }

const HANDOFF_PREFIX = 'HANDOFF:'
const ASK_CHOICE_TOOL = 'ask_choice'
const MAX_TOOL_ITERATIONS = 5

const TONE_INSTRUCTIONS: Record<AiTone, string> = {
  friendly: 'Use a warm, friendly tone.',
  professional: 'Use a clear, professional tone.',
  playful: 'Use a warm, playful tone with occasional light humor.',
}

const LOCALES = ['zh-HK', 'zh-CN', 'en']

// Pseudo-tool: not backed by real logic. When the model's intent is
// ambiguous (e.g. no date given for an availability question), it calls this
// instead of guessing in free text, so the client can render buttons instead
// of the model asking an open-ended question. Detected before real tool
// execution — the loop stops and returns the choice to the client rather
// than looping again.
const ASK_CHOICE_DEFINITION: Anthropic.Tool = {
  name: ASK_CHOICE_TOOL,
  description:
    'Ask the visitor to pick from a short list of options instead of typing free text, when their request is ambiguous (e.g. no date/time given). Use this instead of asking an open-ended question in your reply.',
  input_schema: {
    type: 'object',
    properties: {
      question: { type: 'string' },
      options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 4 },
    },
    required: ['question', 'options'],
  },
}

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

    const [config, widgetSettings, toolCtx] = await Promise.all([
      getConfig(),
      getAiWidgetSettings(locale),
      buildToolContext(),
    ])

    let systemPrompt = `You are Space8's helpful assistant, replying in plain, friendly English. Keep replies under 3 sentences.

Venue facts (from the database, do not alter):
- Name: Space8
- Hours: ${config.openHour}:00–${config.closeHour === 24 ? '24' : config.closeHour}:00 daily
- Tables: 2 (Table #1, Table #2)
- Base rate: HK$${config.pricePerHour}/hour

Rules:
- Never make up information you're unsure about. Use the check_availability and get_pricing_and_hours tools for anything about open slots, hours, or prices instead of guessing.
- You cannot lock a slot or take payment yourself. If a visitor wants to actually book a specific date/time/table, first confirm availability with check_availability, then tell them you've found it and give them this exact link to finish: /book?date=YYYY-MM-DD&start=HOUR&duration=HOURS&table=NUMBER (they'll still need to sign in and pay there).
- If the visitor's request is ambiguous (no date, no time, unclear which table), call ${ASK_CHOICE_TOOL} with 2-4 short options instead of asking an open-ended question in text.
- If you cannot help with the request (it's a complaint, an injury/safety issue, a legal matter, or something requiring human judgment), respond with exactly the sentinel prefix "${HANDOFF_PREFIX}" followed by one short sentence explaining why, and nothing else.
- Structure any answer with more than one distinct point as short bullet lines starting with "- ", and wrap the most important word or phrase in **double asterisks**. Don't do this for a single simple sentence.

${TONE_INSTRUCTIONS[widgetSettings.tone]}`

    // Additive layer, never a replacement — per the admin settings spec.
    if (widgetSettings.systemPromptOverride) {
      systemPrompt += `\n\n${widgetSettings.systemPromptOverride}`
    }

    const complexity = classifyComplexity(userMessage)
    const vectorEngine = getVectorEngine()
    const model = modelFor(complexity)
    const tools: Anthropic.Tool[] = [...toolDefinitions(toolCtx), ASK_CHOICE_DEFINITION]

    const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: userMessage }]

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await vectorEngine.messages.create({
        model,
        max_tokens: 500,
        system: systemPrompt,
        messages,
        tools,
      })

      if (response.stop_reason === 'refusal') {
        return NextResponse.json({ reply: "Sorry, I can't help with that." })
      }

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        const textBlock = response.content.find((b) => b.type === 'text')
        const rawReply = textBlock?.text ?? "Sorry, I couldn't generate a reply — please try again."

        if (rawReply.startsWith(HANDOFF_PREFIX)) {
          const explanation = rawReply.slice(HANDOFF_PREFIX.length).trim()
          return NextResponse.json({ reply: explanation, handoff: true })
        }
        return NextResponse.json({ reply: rawReply })
      }

      const askChoice = toolUseBlocks.find((b) => b.name === ASK_CHOICE_TOOL)
      if (askChoice) {
        const input = askChoice.input as { question?: unknown; options?: unknown }
        const question = typeof input.question === 'string' ? input.question : 'Which would you like?'
        const options = Array.isArray(input.options) ? input.options.filter((o): o is string => typeof o === 'string') : []
        if (options.length >= 2) {
          return NextResponse.json({ type: 'choice', question, options })
        }
        // Malformed ask_choice call — fall through and let the loop continue
        // with an error tool_result so the model tries a normal text reply.
      }

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.name === ASK_CHOICE_TOOL) {
            return {
              type: 'tool_result' as const,
              tool_use_id: block.id,
              content: JSON.stringify({ error: 'invalid_ask_choice_input' }),
              is_error: true,
            }
          }
          const input = isRecord(block.input) ? block.input : {}
          const result = await runTool(block.name, input, toolCtx)
          return { type: 'tool_result' as const, tool_use_id: block.id, content: JSON.stringify(result) }
        })
      )
      messages.push({ role: 'user', content: toolResults })
    }

    return NextResponse.json({ reply: "Sorry, I couldn't reply — please try again." })
  } catch (err) {
    if (err instanceof VectorEngineConfigError) {
      console.error('[ai/chat] VectorEngine not configured')
      return NextResponse.json({ error: 'vectorengine_not_configured' }, { status: 503 })
    }
    console.error('[ai/chat] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
