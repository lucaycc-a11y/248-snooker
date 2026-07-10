import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMemberQR, getRecommendedQRSize } from '@/lib/qrcode'

/**
 * GET /api/member/qr
 *
 * Generates QR code for authenticated member's member_code.
 * Returns data URL (base64-encoded PNG) for display in browser.
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

    // Generate QR code as data URL
    const qrDataUrl = await generateMemberQR(userData.member_code, {
      format: 'data-url',
      width: getRecommendedQRSize('display'),
      color: {
        dark: '#0a0a0a',
        light: '#fdfcf8',
      },
    })

    return NextResponse.json({ qrCode: qrDataUrl })
  } catch (error) {
    console.error('[API /member/qr] Failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
