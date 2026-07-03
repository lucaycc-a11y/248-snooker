import { getPublicSupabase } from '@/lib/supabase/public'

// Per-locale, admin-configurable AI widget content (greeting, quick-reply
// prompts, tone, and an additive system-prompt override) — public-read via
// RLS, matching getCMS.ts's own convention of "never let a missing row break
// the page": falls back to a bundled default per locale when Supabase is
// unreachable or no row exists yet for that locale.

export type AiTone = 'friendly' | 'professional' | 'playful'

export type AiWidgetSettings = {
  greetingMessage: string
  suggestedPrompts: string[]
  systemPromptOverride: string | null
  tone: AiTone
}

const DEFAULT_PROMPTS: Record<string, string[]> = {
  'zh-HK': ['查詢今日仲有咩時段', '會員積分點計', '點樣退款/改期', '場地喺邊度'],
  'zh-CN': ['查询今天还有什么时段', '会员积分怎么算', '怎样退款/改期', '场地在哪里'],
  en: ['What slots are open today?', 'How do member points work?', 'How do refunds/reschedules work?', 'Where are you located?'],
  ja: ['本日の空き状況は?', '会員ポイントの仕組みは?', '返金・変更方法は?', '場所はどこですか?'],
}

const DEFAULT_GREETING: Record<string, string> = {
  'zh-HK': '你好！我可以點幫到你？',
  'zh-CN': '你好！我可以怎么帮到你？',
  en: 'Hi! How can I help?',
  ja: 'こんにちは！何かお手伝いできますか？',
}

function defaultsFor(locale: string): AiWidgetSettings {
  return {
    greetingMessage: DEFAULT_GREETING[locale] ?? DEFAULT_GREETING['zh-HK'],
    suggestedPrompts: DEFAULT_PROMPTS[locale] ?? DEFAULT_PROMPTS['zh-HK'],
    systemPromptOverride: null,
    tone: 'friendly',
  }
}

export async function getAiWidgetSettings(locale = 'zh-HK'): Promise<AiWidgetSettings> {
  const supabase = getPublicSupabase()
  if (!supabase) return defaultsFor(locale)
  try {
    const { data } = await supabase
      .from('ai_widget_settings')
      .select('greeting_message, suggested_prompts, system_prompt_override, tone')
      .eq('locale', locale)
      .maybeSingle()
    if (!data) return defaultsFor(locale)
    return {
      greetingMessage: (data.greeting_message as string) ?? defaultsFor(locale).greetingMessage,
      suggestedPrompts: Array.isArray(data.suggested_prompts) ? (data.suggested_prompts as string[]) : defaultsFor(locale).suggestedPrompts,
      systemPromptOverride: (data.system_prompt_override as string | null) ?? null,
      tone: (data.tone as AiTone) ?? 'friendly',
    }
  } catch {
    return defaultsFor(locale)
  }
}
