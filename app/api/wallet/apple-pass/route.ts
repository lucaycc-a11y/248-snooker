import { NextRequest, NextResponse } from 'next/server'
import { PKPass } from 'passkit-generator'
import path from 'path'
import { getWalletMember, TIER_DISPLAY } from '@/lib/wallet/shared'

/**
 * GET /api/wallet/apple-pass
 *
 * Generates a signed Apple Wallet pass (.pkpass) for the authenticated
 * member and streams it back as a download.  The pass is a `storeCard`
 * matching the Space8 brand (black bg, green accent, trilingual l10n).
 *
 * Env vars required:
 *   APPLE_TEAM_ID          – Apple Developer Team ID
 *   APPLE_PASS_TYPE_ID     – pass type identifier (e.g. pass.com.248.member)
 *   APPLE_PASS_CERT        – PEM (or p12) of the Apple Wallet certificate
 *   APPLE_PASS_CERT_PASSWORD – passphrase for the cert above
 *   APPLE_WWDR_CERT        – Apple WWDR certificate (PEM)
 */
export async function GET(_req: NextRequest) {
  try {
    // ── Auth + member data ────────────────────────────────────────────────
    const member = await getWalletMember()
    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Certificates from env ─────────────────────────────────────────────
    const teamId = process.env.APPLE_TEAM_ID
    const passTypeId = process.env.APPLE_PASS_TYPE_ID ?? 'pass.com.248.member'
    const signerCert = process.env.APPLE_PASS_CERT
    const signerKeyPassphrase = process.env.APPLE_PASS_CERT_PASSWORD
    const wwdr = process.env.APPLE_WWDR_CERT

    if (!teamId || !signerCert || !wwdr) {
      console.error('[wallet/apple-pass] Missing required env vars (APPLE_TEAM_ID, APPLE_PASS_CERT, APPLE_WWDR_CERT)')
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
    }

    // ── Build pass from folder model ──────────────────────────────────────
    const modelPath = path.join(process.cwd(), 'pass-templates', 'membership.pass')

    const pass = await PKPass.from(
      {
        model: modelPath,
        certificates: {
          wwdr,
          signerCert,
          signerKey: signerCert, // same cert file; passkit-generator uses signerKey separately
          signerKeyPassphrase,
        },
      },
      {
        // Override template placeholders with live data
        serialNumber: member.memberCode,
        passTypeIdentifier: passTypeId,
        teamIdentifier: teamId,
        description: `SPACE8 Member — ${member.displayName}`,
      },
    )

    // ── Populate fields ───────────────────────────────────────────────────
    // Fields are FieldsArray instances (extends Array). Push items rather than
    // reassign, because the type setter resets them.
    const tierName = TIER_DISPLAY[member.tierId]?.en ?? member.tierId

    pass.primaryFields.push(
      { key: 'member', label: 'MEMBER_LABEL', value: member.displayName },
    )

    pass.secondaryFields.push(
      { key: 'tier', label: 'TIER_LABEL', value: tierName },
      { key: 'points', label: 'POINTS_LABEL', value: String(member.points) },
    )

    if (member.latestBooking) {
      pass.auxiliaryFields.push({
        key: 'latestBooking',
        label: 'NEXT_BOOKING_LABEL',
        value: `${member.latestBooking.date} ${member.latestBooking.startTime}`,
      })
    } else {
      pass.auxiliaryFields.push({
        key: 'latestBooking',
        label: 'NEXT_BOOKING_LABEL',
        value: 'NO_BOOKING_VALUE',
      })
    }

    // ── Barcode (QR) ──────────────────────────────────────────────────────
    pass.setBarcodes(member.memberCode)

    // The `.lproj` pass.strings files were already loaded into the pass by
    // addBuffer() during PKPass.from() (see PKPass.js addBuffer → localize),
    // so field labels/values that match keys there ("MEMBER_LABEL",
    // "NO_BOOKING_VALUE", …) resolve per the device language automatically.

    // ── Export ────────────────────────────────────────────────────────────
    const buffer = pass.getAsBuffer()

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="SPACE8_Member.pkpass"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('[wallet/apple-pass] Failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}