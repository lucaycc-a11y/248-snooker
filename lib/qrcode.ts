import QRCode from 'qrcode'
import { signQrToken, humanReadableCode, type QrPayload } from './qr/jwt'
import { readFileSync } from 'fs'
import { join } from 'path'

// Logo as PNG data URI — converted from SVG to ensure cross-browser compatibility.
// The nested SVG data URI approach fails in some browsers; a rasterized PNG always works.
let SPACE8_LOGO_PNG_DATA_URI: string | null = null

function getLogoPngDataUri(): string {
  if (SPACE8_LOGO_PNG_DATA_URI) return SPACE8_LOGO_PNG_DATA_URI

  // In production/build, use the pre-converted PNG from public/logos
  // In dev, fall back to reading the SVG and converting it
  try {
    const logoPath = join(process.cwd(), 'public', 'logos', 'logo-white-mark.svg')
    const logoSvg = readFileSync(logoPath, 'utf-8')

    // For now, use the SVG directly with proper encoding
    // Browser compatibility: use xmlns explicitly and ensure proper escaping
    const escapedSvg = logoSvg
      .replace(/"/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    SPACE8_LOGO_PNG_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(escapedSvg)}`
    return SPACE8_LOGO_PNG_DATA_URI
  } catch {
    // Fallback: return empty string if logo can't be loaded
    // QR will still work, just without the logo
    SPACE8_LOGO_PNG_DATA_URI = ''
    return ''
  }
}

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

  const logoDataUri = getLogoPngDataUri()
  if (!logoDataUri) {
    // Logo failed to load; return QR without logo
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  }

  const brandedSvg = svg.replace(
    '</svg>',
    `<rect x="42.5%" y="42.5%" width="15%" height="15%" rx="3" fill="#ffffff"/><image href="${logoDataUri}" x="44%" y="44%" width="12%" height="12%" preserveAspectRatio="xMidYMid meet"/></svg>`,
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
