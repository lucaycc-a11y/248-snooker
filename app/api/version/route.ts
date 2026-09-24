import { NextResponse } from 'next/server'
import packageJson from '@/package.json'

// ════════════════════════════════════════════════════════════════════════════
// GET /api/version — Returns app version from package.json
// ════════════════════════════════════════════════════════════════════════════

export async function GET() {
  return NextResponse.json({ version: packageJson.version })
}
