import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getAdminStats, getRevenueSeries } from '@/lib/data/getAdminStats'
import { getVectorEngine } from '@/lib/ai/vectorengine'

// Admin-only "Today's summary" button. Auth-gated + low call volume (a human
// clicking a button a few times a day) — no separate rate limit needed on top
// of the admin guard, unlike the public chat/CMS-edit endpoints.

export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [stats, revenue] = await Promise.all([getAdminStats(), getRevenueSeries(7)])

    const vectorEngine = getVectorEngine()
    const response = await vectorEngine.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system:
        'You summarize business performance for a snooker club admin dashboard. Plain English, 2-3 sentences, no fluff, no bullet points.',
      messages: [
        {
          role: 'user',
          content: `Today's stats: ${JSON.stringify(stats)}\nLast 7 days revenue: ${JSON.stringify(revenue)}\n\nSummarize today's business performance.`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ summary: 'Unable to generate a summary right now.' })
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    return NextResponse.json({ summary: textBlock?.text ?? 'Unable to generate a summary right now.' })
  } catch (err) {
    console.error('[admin/ai/summary] unexpected error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
