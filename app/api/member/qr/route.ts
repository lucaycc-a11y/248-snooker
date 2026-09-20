import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMemberQRWithLogo } from '@/lib/qrcode'

/**
 * GET /api/member/qr
 *
 * Generates a branded QR code for the authenticated member's member_code.
 * Returns a data:image/svg+xml;base64 URL for display in browser.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch member code from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('member_code')
      .eq('id', user.id)
      .single()

    if (userError || !userData?.member_code) {
      return NextResponse.json(
        { error: 'Member code not found' },
        { status: 404 }
      )
    }

    const qrDataUrl = await generateMemberQRWithLogo(userData.member_code, 400)

    return NextResponse.json({ qrCode: qrDataUrl })
  } catch (error) {
    console.error('[API /member/qr] Failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
