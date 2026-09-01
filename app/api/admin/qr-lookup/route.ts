/**
 * QR Lookup API — §11.1.
 *
 * GET /api/admin/qr-lookup?q=<query>
 * Accepts: booking human_code, user ID, user email, user phone.
 * Returns: { type, id, reference, detail, url }
 *
 * Security: requires admin auth (getAdminData).
 * Design system: admin-theme.css variables only. NO inline hex, NO shadows, NO `any`.
 */

import { NextResponse } from 'next/server'
import { getAdminData } from '@/lib/data/getAdmin'
import { getServiceSupabase } from '@/lib/supabase/service'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function str(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return null
}

export async function GET(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const q = url.searchParams.get('q')?.trim()
    if (!q) {
      return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const origin = url.origin

    // 1. Try booking lookup by human_code
    const { data: bookingRow } = await service
      .from('bookings')
      .select('id, human_code, user_id, created_at')
      .ilike('human_code', q)
      .maybeSingle()

    if (isRecord(bookingRow) && typeof bookingRow.id === 'string') {
      const userId = typeof bookingRow.user_id === 'string' ? bookingRow.user_id : null
      let detail = `Created ${new Date(bookingRow.created_at as string).toLocaleDateString()}`
      if (userId) {
        const { data: userRow } = await service
          .from('users')
          .select('display_name, email')
          .eq('id', userId)
          .maybeSingle()
        if (isRecord(userRow)) {
          const name = str(userRow as Record<string, unknown>, ['display_name', 'name'])
          const email = str(userRow as Record<string, unknown>, ['email'])
          if (name || email) detail = `${name ?? '—'} · ${email ?? '—'}`
        }
      }
      return NextResponse.json({
        type: 'booking',
        id: bookingRow.id,
        reference: bookingRow.human_code ?? bookingRow.id.slice(0, 8),
        detail,
        url: `${origin}/booking/${bookingRow.id}`,
      })
    }

    // 2. Try user lookup by ID
    const { data: userIdRow } = await service
      .from('users')
      .select('id, display_name, name, email, phone, member_code, created_at')
      .eq('id', q)
      .maybeSingle()

    if (isRecord(userIdRow) && typeof userIdRow.id === 'string') {
      const name = str(userIdRow as Record<string, unknown>, ['display_name', 'name'])
      const email = str(userIdRow as Record<string, unknown>, ['email'])
      return NextResponse.json({
        type: 'user',
        id: userIdRow.id,
        reference: userIdRow.member_code as string ?? userIdRow.id.slice(0, 8),
        detail: [name, email].filter(Boolean).join(' · ') || 'No details',
        url: `${origin}/profile/${userIdRow.id}`,
      })
    }

    // 3. Try user lookup by email
    const { data: emailRow } = await service
      .from('users')
      .select('id, display_name, name, email, phone, member_code, created_at')
      .ilike('email', q)
      .maybeSingle()

    if (isRecord(emailRow) && typeof emailRow.id === 'string') {
      const name = str(emailRow as Record<string, unknown>, ['display_name', 'name'])
      const email = str(emailRow as Record<string, unknown>, ['email'])
      return NextResponse.json({
        type: 'user',
        id: emailRow.id,
        reference: emailRow.member_code as string ?? emailRow.id.slice(0, 8),
        detail: [name, email].filter(Boolean).join(' · ') || 'No details',
        url: `${origin}/profile/${emailRow.id}`,
      })
    }

    // 4. Try user lookup by phone (partial match)
    const { data: phoneRow } = await service
      .from('users')
      .select('id, display_name, name, email, phone, member_code, created_at')
      .like('phone', `%${q}%`)
      .maybeSingle()

    if (isRecord(phoneRow) && typeof phoneRow.id === 'string') {
      const name = str(phoneRow as Record<string, unknown>, ['display_name', 'name'])
      const email = str(phoneRow as Record<string, unknown>, ['email'])
      return NextResponse.json({
        type: 'user',
        id: phoneRow.id,
        reference: phoneRow.member_code as string ?? phoneRow.id.slice(0, 8),
        detail: [name, email].filter(Boolean).join(' · ') || 'No details',
        url: `${origin}/profile/${phoneRow.id}`,
      })
    }

    return NextResponse.json(
      { error: `No booking or user found for "${q}"` },
      { status: 404 },
    )
  } catch (err) {
    console.error('[admin/qr-lookup] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
