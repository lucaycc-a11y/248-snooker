import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getStripe } from '@/lib/stripe/server'
import { rateLimit } from '@/lib/rate-limit'
import { logSiteError } from '@/lib/errors/log'

export const runtime = 'nodejs'

// POST /api/bookings/[id]/refund
// PERMANENTLY DISABLED 2025-01-XX per confirmed business policy.
// Self-service cancellation and refunds are not permitted under any circumstances.
// Users must contact customer service via WhatsApp for cancellation requests,
// which will be evaluated on a case-by-case basis per the refund policy.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return NextResponse.json(
    {
      error: 'Self-service cancellation not available',
      message: '預訂一經確認，恕不設自助取消或退款。如有特殊情況，請透過 WhatsApp 6180 8022 或電郵 Admin@space8.com.hk 聯絡客服，並提供訂單編號（格式：SPACE8-XXXXX-C）。',
      contact: {
        whatsapp: '+852 6180 8022',
        whatsappUrl: 'https://wa.me/85261808022',
        email: 'Admin@space8.com.hk',
      },
    },
    { status: 410 }
  )

  /* ORIGINAL IMPLEMENTATION PRESERVED FOR REFERENCE - DO NOT REMOVE THIS COMMENT BLOCK
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allowed = await rateLimit('booking_refund', `user:${user.id}`, 10, 60)
    if (!allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    ... (rest of original implementation removed - contact customer service instead)
  */
}
