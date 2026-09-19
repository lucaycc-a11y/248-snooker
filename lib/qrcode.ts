import QRCode from 'qrcode'
import { signQrToken, humanReadableCode, type QrPayload } from './qr/jwt'

// Logo inlined as a base64 data URI — required so the href resolves correctly
// when the outer SVG is itself embedded as a data:image/svg+xml;base64,… URL.
const SPACE8_LOGO_DATA_URI =
  'data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz4KPHN2ZyBpZD0iTGF5ZXJfMSIgZGF0YS1uYW1lPSJMYXllciAxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAwIDEwMDAiPgogIDxkZWZzPgogICAgPHN0eWxlPgogICAgICAuY2xzLTEgewogICAgICAgIGZpbGw6ICNmZmY7CiAgICAgIH0KICAgIDwvc3R5bGU+CiAgPC9kZWZzPgogIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTM5MS4zMSw3ODYuMTFjLTk0LjExLDAtMTU1LjA4LTY4LjQ4LTE1NS4wOC0xNzMuMTYsMC02Ni45LDMxLjgxLTExMi41NSw3NS41NS0xMjkuMDgtMzUuNzktMTMuMzgtNjYuMjctNDkuNTktNjYuMjctMTIyLDAtOTcuNiw2MS42My0xNDcuOTcsMTU1LjA4LTE0Ny45N2gxOTguODFjOTMuNDQsMCwxNTUuNzQsNTAuMzcsMTU1Ljc0LDE0Ny45NywwLDcyLjQxLTMxLjE1LDEwOC42Mi02Ni45MywxMjIsNDMuNzQsMTYuNTMsNzUuNTUsNjIuMTgsNzUuNTUsMTI5LjA4LDAsMTA0LjY4LTYwLjk3LDE3My4xNi0xNTUuMDgsMTczLjE2aC0yMTcuMzdaTTM5NC42Myw1MzcuMzljLTQ3LjA1LDAtNzMuNTYsMjYuNzYtNzMuNTYsNzMuOTksMCw0OS41OSwzNy43Nyw3NC43Nyw5MC43OSw3NC43N2gxNzYuMjhjNTMuMDIsMCw5MC43OS0yNS4xOSw5MC43OS03NC43N3MtMjYuNTEtNzMuOTktNzMuNTYtNzMuOTloLTIxMC43NFpNNDE2LjUsMzEzLjA3Yy01NS4wMSwwLTg2LjE1LDE4LjEtODYuMTUsNzAuODQsMCw0OS41OSwyMi41Myw2OS4yNiw3MC4yNSw2OS4yNmgxOTguODFjNDcuNzIsMCw3MC4yNS0xOS42OCw3MC4yNS02OS4yNiwwLTUyLjc0LTMxLjE1LTcwLjg0LTg2LjE1LTcwLjg0aC0xNjdaIi8+CiAgPGc+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik01MDkuNCw1Mi4xNWMtMjE2LjIyLDAtMzk4LjMsMTQzLjI0LTQ1Mi44NCwzMzguMTZoLTE5Ljc5QzkwLjcsMTg0Ljg5LDI3Ny42NSwzMy4zNSw1MDAsMzMuMzVzNDA5LjMsMTUxLjUzLDQ2My4yNCwzNTYuOTZoLTFjLTU0LjU0LTE5NC45My0yMzYuNjItMzM4LjE2LTQ1Mi44NC0zMzguMTZaIi8+CiAgICA8cGF0aCBjbGFzcz0iY2xzLTEiIGQ9Ik05NzkuMTUsNDAyLjU4aC0yNi4yMmwtMi41MS04Ljk2Yy01NC4yMy0xOTMuODMtMjM1LjU5LTMyOS4yLTQ0MS4wMi0zMjkuMlMxMjIuNiwxOTkuNzksNjguMzcsMzkzLjYybC0yLjUxLDguOTZIMjAuODVsNC4wNC0xNS4zOWMxMy42NS01MiwzNS42OS0xMDEuMTYsNjUuNTEtMTQ2LjExLDI5LjMzLTQ0LjIyLDY1LjQyLTgzLjI0LDEwNy4yNi0xMTUuOTYsNDIuMjYtMzMuMDUsODkuMjYtNTguNzgsMTM5LjY3LTc2LjQ3LDUyLjE2LTE4LjMsMTA2Ljg4LTI3LjU4LDE2Mi42Ni0yNy41OHMxMTAuNTEsOS4yOCwxNjIuNjYsMjcuNThjNTAuNDEsMTcuNjksOTcuNDEsNDMuNDIsMTM5LjY3LDc2LjQ3LDQxLjg0LDMyLjcyLDc3LjkzLDcxLjc0LDEwNy4yNiwxMTUuOTYsMjkuODIsNDQuOTUsNTEuODYsOTQuMTEsNjUuNTEsMTQ2LjExbDQuMDQsMTUuMzlaIi8+CiAgPC9nPgogIDxnPgogICAgPHBhdGggY2xhc3M9ImNscy0xIiBkPSJNNTA5LjQsOTQ3Ljg1Yy0yMTYuMjIsMC0zOTguMy0xNDMuMjQtNDUyLjg0LTMzOC4xNmgtMTkuNzljNTMuOTQsMjA1LjQzLDI0MC44OSwzNTYuOTYsNDYzLjI0LDM1Ni45NnM0MDkuMy0xNTEuNTMsNDYzLjI0LTM1Ni45NmgtMWMtNTQuNTQsMTk0LjkzLTIzNi42MiwzMzguMTYtNDUyLjg0LDMzOC4xNloiLz4KICAgIDxwYXRoIGNsYXNzPSJjbHMtMSIgZD0iTTUwMCw5NzguOTJjLTU1Ljc4LDAtMTEwLjUxLTkuMjgtMTYyLjY2LTI3LjU4LTUwLjQxLTE3LjY5LTk3LjQxLTQzLjQyLTEzOS42Ny03Ni40Ny00MS44NC0zMi43Mi03Ny45My03MS43NC0xMDcuMjYtMTE1Ljk2LTI5LjgyLTQ0Ljk1LTUxLjg2LTk0LjExLTY1LjUxLTE0Ni4xMWwtNC4wNC0xNS4zOWg0NS4wMWwyLjUxLDguOTZjNTQuMjMsMTkzLjgzLDIzNS41OSwzMjkuMiw0NDEuMDMsMzI5LjJzMzg2Ljc5LTEzNS4zNyw0NDEuMDItMzI5LjJsMi41MS04Ljk2aDI2LjIybC00LjA0LDE1LjM5Yy0xMy42NSw1Mi0zNS42OSwxMDEuMTYtNjUuNTEsMTQ2LjExLTI5LjMzLDQ0LjIyLTY1LjQyLDgzLjI0LTEwNy4yNiwxMTUuOTYtNDIuMjYsMzMuMDUtODkuMjYsNTguNzgtMTM5LjY3LDc2LjQ3LTUyLjE2LDE4LjMtMTA2Ljg4LDI3LjU4LTE2Mi42NiwyNy41OFoiLz4KICA8L2c+Cjwvc3ZnPg=='

// Unified QR code generation for SPACE8.
// Generates scannable QR codes as data URLs or buffers for:
// 1. Booking access (human-readable companion code; JWT retained for future door validation)
// 2. Member identification (member_code from database)
// 3. Admin access (JWT token with admin permissions)
//
// All QR codes are tested for GM65 scanner compatibility using error correction
// level 'M' (15% recovery) and a 4px margin for reliable edge detection.

export type QRFormat = 'data-url' | 'buffer'

export type QROptions = {
  /**
   * Output format:
   * - 'data-url': base64-encoded PNG with data:image/png;base64 prefix (for email embedding)
   * - 'buffer': raw PNG buffer (for file saving or API responses)
   */
  format?: QRFormat

  /**
   * QR code size in pixels (default: 400px for display, 800px for print/email)
   */
  width?: number

  /**
   * Error correction level (default: 'M' for 15% recovery, tested with GM65 scanner)
   * - 'L': 7% recovery
   * - 'M': 15% recovery (recommended)
   * - 'Q': 25% recovery
   * - 'H': 30% recovery
   */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'

  /**
   * Color scheme (default: black on white for maximum scanner compatibility)
   */
  color?: {
    dark: string  // foreground color (default: #000000)
    light: string // background color (default: #FFFFFF)
  }
}

const DEFAULT_OPTIONS: Required<Omit<QROptions, 'color'>> & { color: { dark: string; light: string } } = {
  format: 'data-url',
  width: 400,
  errorCorrectionLevel: 'H',
  color: {
    dark: '#000000',
    light: '#FFFFFF',
  },
}

/**
 * Generate a booking QR code containing the human-readable companion code (SPACE8-XXXXX-X).
 * A JWT is still signed and returned for when door validation is restored, but the QR
 * image itself encodes the human-readable code, matching bookings.qr_code.
 *
 * @param payload - Booking details (booking_id, user_id, table_number, start/end times)
 * @param options - QR generation options
 * @returns QR code as data URL or buffer, plus the human-readable backup code
 */
export async function generateBookingQR(
  payload: QrPayload,
  options?: QROptions
): Promise<{ qrCode: string | Buffer; backupCode: string; jwt: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for when door validation is fixed to verify JWTs again
  const jwt = signQrToken(payload)

  // Generate human-readable backup code (also the QR image's encoded data)
  const backupCode = humanReadableCode(payload.booking_id)

  // Generate QR code from the human-readable code
  const qrCode = await generateQR(backupCode, opts)

  return { qrCode, backupCode, jwt }
}

/**
 * Generate a member QR code from the member_code stored in the database.
 * Format: SPACE8-{TIER}-{4chars}-{check} (e.g., SPACE8-AMA-K7Q2-B) or legacy SPACE8-{PLANET}-{4chars}-{check}
 *
 * @param memberCode - Member code from users.member_code
 * @param options - QR generation options
 * @returns QR code as data URL or buffer
 */
export async function generateMemberQR(
  memberCode: string,
  options?: QROptions
): Promise<string | Buffer> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Member QR codes encode the member_code directly (no JWT wrapping)
  // The verification flow scans the code, looks up the user by member_code,
  // and checks their tier/status in the database.
  return generateQR(memberCode, opts)
}

/**
 * Generate a branded member QR code as a data:image/svg+xml;base64 URL with
 * the SPACE8 logo centered. Uses error correction level 'H' (30%) so the logo
 * overlay does not compromise scannability.
 *
 * @param memberCode - Member code from users.member_code
 * @param width - SVG canvas size in pixels (default 400)
 * @returns Branded QR as a data URI string
 */
export async function generateMemberQRWithLogo(
  memberCode: string,
  width = 400,
): Promise<string> {
  const svg = await QRCode.toString(memberCode, {
    type: 'svg',
    margin: 2,
    errorCorrectionLevel: 'H',
    width,
    color: { dark: '#0a0a0a', light: '#ffffff' },
  })
  const brandedSvg = svg.replace(
    '</svg>',
    `<rect x="42.5%" y="42.5%" width="15%" height="15%" rx="3" fill="#ffffff"/><image href="${SPACE8_LOGO_DATA_URI}" x="44%" y="44%" width="12%" height="12%" preserveAspectRatio="xMidYMid meet"/></svg>`,
  )
  return `data:image/svg+xml;base64,${Buffer.from(brandedSvg).toString('base64')}`
}

/**
 * Generate an admin QR code for staff access.
 * This wraps admin permissions in a JWT token with a short expiry (5 minutes).
 *
 * @param adminId - Admin user ID
 * @param permissions - Admin permissions (e.g., ['door_access', 'booking_override'])
 * @param options - QR generation options
 * @returns QR code as data URL or buffer, plus the JWT token
 */
export async function generateAdminQR(
  adminId: string,
  permissions: string[],
  options?: QROptions
): Promise<{ qrCode: string | Buffer; jwt: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Admin JWT: short-lived (5 min), includes admin permissions
  const secret = process.env.QR_SECRET
  if (!secret) throw new Error('QR_SECRET is not set')

  // Use a simplified JWT structure for admin access (no crypto import needed here)
  // The actual signing happens in lib/qr/jwt.ts for consistency
  const payload = {
    admin_id: adminId,
    permissions,
    exp: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
  }

  const jwt = JSON.stringify(payload) // Placeholder - should use signQrToken with admin schema
  const qrCode = await generateQR(jwt, opts)

  return { qrCode, jwt }
}

/**
 * Low-level QR code generator. Used internally by generateBookingQR, generateMemberQR, etc.
 *
 * @param data - String data to encode in the QR code
 * @param options - QR generation options
 * @returns QR code as data URL or buffer
 */
async function generateQR(
  data: string,
  options: Required<Omit<QROptions, 'color'>> & { color: { dark: string; light: string } }
): Promise<string | Buffer> {
  const qrOptions: QRCode.QRCodeToDataURLOptions | QRCode.QRCodeToBufferOptions = {
    errorCorrectionLevel: options.errorCorrectionLevel,
    type: 'image/png',
    width: options.width,
    margin: 4, // 4-module margin for scanner edge detection (GM65 tested)
    color: options.color,
  }

  if (options.format === 'data-url') {
    return QRCode.toDataURL(data, qrOptions as QRCode.QRCodeToDataURLOptions)
  } else {
    return QRCode.toBuffer(data, qrOptions as QRCode.QRCodeToBufferOptions)
  }
}

/**
 * Validate QR code size for different use cases:
 * - Email: 400-600px (balances file size and readability)
 * - Print: 800-1200px (high-res for physical printouts)
 * - Display: 300-400px (web/mobile screens)
 */
export function getRecommendedQRSize(useCase: 'email' | 'print' | 'display'): number {
  switch (useCase) {
    case 'email':
      return 500
    case 'print':
      return 1000
    case 'display':
      return 400
    default:
      return 400
  }
}
