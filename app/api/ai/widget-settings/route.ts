import { NextResponse } from 'next/server'
import { getAiWidgetSettings } from '@/lib/data/getAiWidgetSettings'

// Public read for the AI chat widget's home screen (greeting + quick-reply
// chips) — no admin auth, this is consumed by the public site's floating
// widget. Only exposes the two fields the widget needs; tone and
// system_prompt_override stay server-side (used only inside app/api/ai/chat).

const LOCALES = ['zh-HK', 'zh-CN', 'en', 'ja']

export async function GET(req: Request) {
  const url = new URL(req.url)
  const localeParam = url.searchParams.get('locale')
  const locale = localeParam && LOCALES.includes(localeParam) ? localeParam : 'zh-HK'

  const settings = await getAiWidgetSettings(locale)
  return NextResponse.json({ greetingMessage: settings.greetingMessage, suggestedPrompts: settings.suggestedPrompts })
}
