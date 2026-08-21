import { NextRequest, NextResponse } from 'next/server'
import { getWalletMember, TIER_DISPLAY, WALLET_LABELS } from '@/lib/wallet/shared'

// ── Types for the Google Wallet JWT payload ─────────────────────────────
type LocalizedString = {
  defaultValue: { language: string; value: string }
  translatedValues?: { language: string; value: string }[]
}

function localized(label: Record<string, string>): LocalizedString {
  return {
    defaultValue: { language: 'en', value: label.en },
    translatedValues: [
      { language: 'zh-HK', value: label.zhHK },
      { language: 'zh-CN', value: label.zhCN },
    ],
  }
}

/**
 * GET /api/wallet/google-pass
 *
 * Generates a signed "Save to Google Wallet" JWT for the authenticated
 * member and redirects to the Google Pay save endpoint.
 *
 * Env vars required:
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_KEY — full JSON service-account key
 *   GOOGLE_WALLET_ISSUER_ID          — numeric issuer id
 */
export async function GET(_req: NextRequest) {
  try {
    const member = await getWalletMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rawKey = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_KEY
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID
    if (!rawKey || !issuerId) {
      console.error('[wallet/google-pass] Missing env vars')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    const credentials = JSON.parse(rawKey) as Record<string, string>
    const classId = `${issuerId}.SPACE8_MEMBER_V1`
    const objectId = `${issuerId}.${member.memberCode}`
    const tier = TIER_DISPLAY[member.tierId] ?? TIER_DISPLAY.amateur

    // ── Loyalty class definition (embedded in JWT) ────────────────────────
    const loyaltyClass = {
      id: classId,
      issuerName: 'SPACE8',
      programName: localized({
        en: 'SPACE8 Membership',
        zhHK: 'SPACE8 會員計劃',
        zhCN: 'SPACE8 会员计划',
      }),
      programLogo: {
        sourceUri: { uri: 'https://space8.com.hk/logos/logo-white-mark.svg' },
      },
      reviewStatus: 'UNDER_REVIEW',
      hexBackgroundColor: '#000000',
      hexFontColor: '#FFFFFF',
      hexButtonColor: '#22b86b',
      linksModuleData: {
        uris: [{ uri: 'https://space8.com.hk', description: 'Book a table' }],
      },
      messages: [],
    }

    // ── Loyalty object definition (embedded in JWT) ───────────────────────
    const bookingValue = member.latestBooking
      ? `${member.latestBooking.date} ${member.latestBooking.startTime}`
      : WALLET_LABELS.noBooking.en

    const loyaltyObject = {
      id: objectId,
      classId,
      state: 'ACTIVE' as const,
      barcode: { type: 'QR_CODE' as const, value: member.memberCode },
      accountId: member.memberCode,
      accountName: localized({
        en: member.displayName,
        zhHK: member.displayName,
        zhCN: member.displayName,
      }),
      loyaltyPoints: {
        balance: { string: String(member.points) },
        label: localized(WALLET_LABELS.points),
      },
      textModulesData: [
        {
          id: 'tier',
          header: localized(WALLET_LABELS.tier),
          body: localized(tier),
        },
        {
          id: 'latestBooking',
          header: localized(WALLET_LABELS.latestBooking),
          body: {
            defaultValue: { language: 'en', value: bookingValue },
            translatedValues: [
              { language: 'zh-HK', value: member.latestBooking ? bookingValue : WALLET_LABELS.noBooking.zhHK },
              { language: 'zh-CN', value: member.latestBooking ? bookingValue : WALLET_LABELS.noBooking.zhCN },
            ],
          },
        },
      ],
      linksModuleData: {
        uris: [
          { uri: 'https://space8.com.hk', description: 'Book a table' },
          { uri: 'https://space8.com.hk/member', description: 'Member Dashboard' },
        ],
      },
    }

    // ── Build the Save-to-Wallet JWT ──────────────────────────────────────
    const claims = {
      iss: credentials.client_email,
      aud: 'google',
      typ: 'savetowallet',
      iat: Math.floor(Date.now() / 1000),
      origins: ['space8.com.hk'],
      payload: {
        loyaltyClasses: [loyaltyClass],
        loyaltyObjects: [loyaltyObject],
      },
    }

    const { default: jwt } = await import('jsonwebtoken')
    const saveJwt = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' })

    return NextResponse.redirect(`https://pay.google.com/gp/v/save/${saveJwt}`)
  } catch (err) {
    console.error('[wallet/google-pass] Failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}