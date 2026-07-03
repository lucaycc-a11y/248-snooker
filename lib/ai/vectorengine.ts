import Anthropic from '@anthropic-ai/sdk'

// VectorEngine is a same-wire-protocol Anthropic Messages API proxy — same
// account/billing the WhatsApp bot already uses (see whatsapp-bot/src/ai.js).
// Routed through the official SDK via baseURL override, not raw fetch.
//
// Request shape verified against whatsapp-bot/src/ai.js's callClaude() (a
// confirmed-working reference hitting the same VectorEngine endpoint via raw
// fetch): model/system/messages/max_tokens match exactly, and the Anthropic
// SDK posts to `${baseURL}/v1/messages` by default — the same path the bot
// builds manually. No request-shape bug found; a real 401/404 here most
// likely means VECTORENGINE_BASE_URL/VECTORENGINE_API_KEY are unset or wrong
// in this deployment's environment, not a code defect.

export class VectorEngineConfigError extends Error {
  constructor() {
    super('VectorEngine is not configured (VECTORENGINE_BASE_URL / VECTORENGINE_API_KEY)')
    this.name = 'VectorEngineConfigError'
  }
}

let cached: Anthropic | null = null

export function getVectorEngine(): Anthropic {
  if (cached) return cached
  const baseURL = process.env.VECTORENGINE_BASE_URL
  const apiKey = process.env.VECTORENGINE_API_KEY
  if (!baseURL || !apiKey) {
    throw new VectorEngineConfigError()
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
