import Anthropic from '@anthropic-ai/sdk'

// VectorEngine is a same-wire-protocol Anthropic Messages API proxy — same
// account/billing the WhatsApp bot already uses (see whatsapp-bot/src/ai.js).
// Routed through the official SDK via baseURL override, not raw fetch.

let cached: Anthropic | null = null

export function getVectorEngine(): Anthropic {
  if (cached) return cached
  const baseURL = process.env.VECTORENGINE_BASE_URL
  const apiKey = process.env.VECTORENGINE_API_KEY
  if (!baseURL || !apiKey) {
    throw new Error('VectorEngine is not configured (VECTORENGINE_BASE_URL / VECTORENGINE_API_KEY)')
  }
  cached = new Anthropic({ apiKey, baseURL })
  return cached
}

// Mirrors the routing already live in whatsapp-bot/src/ai.js — kept as two
// small copies (no shared package boundary between this repo's Next.js app
// and the separately-deployed whatsapp-bot/ process). Update both if this
// changes.
export type Complexity = 'simple' | 'complex'

const COMPLEX_SIGNALS = [/refund/i, /退款/, /投訴/, /complaint/, /cancel.*all/i]

export function classifyComplexity(input: string): Complexity {
  return COMPLEX_SIGNALS.some((re) => re.test(input)) || input.length > 400 ? 'complex' : 'simple'
}

export function modelFor(complexity: Complexity): string {
  return complexity === 'complex' ? 'claude-opus-4-8' : 'claude-sonnet-4-6'
}
