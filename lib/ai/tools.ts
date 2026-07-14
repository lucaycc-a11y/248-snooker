import type Anthropic from '@anthropic-ai/sdk'
import { getConfig } from '@/lib/data/getConfig'
import { getAvailableTables } from '@/lib/booking/server'
import { quoteBlockTotal } from '@/lib/pricing'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

// Tool-calling layer for the AI chat backend (app/api/ai/chat/route.ts).
//
// Three permission tiers, enforced server-side (not just prompted):
//   1 (read-only)   — runs immediately, available to anyone including anon visitors.
//   2 (draft write)  — runs immediately, but the write is itself a draft (cms_versions
//                      status='draft') that a human must separately publish, so it's
//                      safe by construction. Admin-gated.
//   3 (needs human)  — the tool NEVER executes the real effect itself; it only
//                      returns a structured suggestion for the client to render as
//                      a "propose this to an admin" card. No such tool is wired in
//                      yet (nothing in the current scope needs it — points/tier/
//                      blacklist changes stay admin-console-only for now).
//
// Booking-via-AI: the public widget is unauthenticated, but slot-lock and
// payment-intent both require a logged-in user, and Stripe here is embedded
// Elements (no hosted payment link to hand back). So there's no tool that
// locks a slot or takes payment — check_availability (tier 1) only tells the
// visitor what's open, and the model is instructed (system prompt) to hand
// them a /book?date=&start=&duration=&table= link to finish in-app.

export type ToolTier = 1 | 2 | 3

export type ToolDef = {
  tier: ToolTier
  adminOnly: boolean
  definition: Anthropic.Tool
  run: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
}

export type ToolContext = {
  isAdmin: boolean
  adminUserId: string | null
  adminEmail: string | null
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}
function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

const checkAvailability: ToolDef = {
  tier: 1,
  adminOnly: false,
  definition: {
    name: 'check_availability',
    description:
      'Check which tables (1 or 2) are free for a given date, start hour, and duration. Use this before suggesting a booking time.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD' },
        start_hour: { type: 'number', description: 'Start hour, 0-23 (venue local time)' },
        duration_hours: { type: 'number', description: 'Booking length in whole hours' },
      },
      required: ['date', 'start_hour', 'duration_hours'],
    },
  },
  run: async (input) => {
    const date = str(input.date)
    const startHour = num(input.start_hour)
    const duration = num(input.duration_hours)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || startHour == null || duration == null) {
      return { error: 'invalid_input' }
    }
    const availableTables = await getAvailableTables(date, startHour, duration)
    return { date, start_hour: startHour, duration_hours: duration, available_tables: availableTables }
  },
}

const getPricingAndHours: ToolDef = {
  tier: 1,
  adminOnly: false,
  definition: {
    name: 'get_pricing_and_hours',
    description:
      'Get venue opening hours and the price quote (HK$) for a specific date/start/duration. Use for any pricing or hours question.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD, optional — omit for general hours/rate info only' },
        start_hour: { type: 'number', description: 'Start hour, 0-23, optional' },
        duration_hours: { type: 'number', description: 'Booking length in whole hours, optional' },
      },
      required: [],
    },
  },
  run: async (input) => {
    const config = await getConfig()
    const date = str(input.date)
    const startHour = num(input.start_hour)
    const duration = num(input.duration_hours)
    const base = {
      open_hour: config.openHour,
      close_hour: config.closeHour,
      base_rate_per_hour: config.pricePerHour,
      currency: config.currency,
      max_hours: config.maxHours,
    }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && startHour != null && duration != null) {
      const total = quoteBlockTotal(date, startHour, duration, config.periods)
      return { ...base, quote: { date, start_hour: startHour, duration_hours: duration, total_hkd: total } }
    }
    return base
  },
}

const proposeCmsEdit: ToolDef = {
  tier: 2,
  adminOnly: true,
  definition: {
    name: 'propose_cms_edit',
    description:
      "Propose a change to a piece of site text (CMS field). This ALWAYS creates a draft that a human admin must review and publish — it never changes the live site directly. Admin-only.",
    input_schema: {
      type: 'object',
      properties: {
        field_key: { type: 'string', description: 'The CMS field key, e.g. hero.tagline' },
        locale: { type: 'string', enum: ['zh-HK', 'zh-CN', 'en'] },
        new_value: { type: 'string', description: 'The proposed new text' },
      },
      required: ['field_key', 'locale', 'new_value'],
    },
  },
  run: async (input, ctx) => {
    if (!ctx.isAdmin || !ctx.adminUserId) return { error: 'admin_required' }
    const fieldKey = str(input.field_key)
    const locale = str(input.locale)
    const newValue = str(input.new_value)
    if (!fieldKey || !locale || newValue == null) return { error: 'invalid_input' }
    if (fieldKey === 'config' || fieldKey.startsWith('config.')) return { error: 'field_not_editable' }

    const service = getServiceSupabase()
    const { data: existing } = await service
      .from('cms_content')
      .select('value')
      .eq('key', fieldKey)
      .eq('locale', locale)
      .maybeSingle()
    const oldValue = (existing?.value as string | undefined) ?? null

    const { data: version, error } = await service
      .from('cms_versions')
      .insert({
        field_key: fieldKey,
        locale,
        old_value: oldValue,
        new_value: newValue,
        changed_by: ctx.adminUserId,
        change_source: 'ai',
        status: 'draft',
      })
      .select('id')
      .single()
    if (error || !version) return { error: 'draft_insert_failed' }

    await service.from('audit_log').insert({
      admin_user_id: ctx.adminUserId,
      admin_email: ctx.adminEmail,
      action: 'cms_ai_edit_proposed',
      target_table: 'cms_versions',
      target_id: version.id,
      before_value: { old_value: oldValue },
      after_value: { new_value: newValue },
    })

    return { success: true, version_id: version.id, field_key: fieldKey, locale, old_value: oldValue, new_value: newValue }
  },
}

const ALL_TOOLS: ToolDef[] = [checkAvailability, getPricingAndHours, proposeCmsEdit]

export async function buildToolContext(): Promise<ToolContext> {
  const admin = await getAdminData()
  return { isAdmin: !!admin, adminUserId: admin?.userId ?? null, adminEmail: admin?.email ?? null }
}

export function availableTools(ctx: ToolContext): ToolDef[] {
  return ALL_TOOLS.filter((t) => !t.adminOnly || ctx.isAdmin)
}

export function toolDefinitions(ctx: ToolContext): Anthropic.Tool[] {
  return availableTools(ctx).map((t) => t.definition)
}

export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const tool = availableTools(ctx).find((t) => t.definition.name === name)
  if (!tool) return { error: 'unknown_tool' }
  try {
    return await tool.run(input, ctx)
  } catch (err) {
    console.error('[ai/tools] tool execution failed', name, err)
    return { error: 'tool_execution_failed' }
  }
}
