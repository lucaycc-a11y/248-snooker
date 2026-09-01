/**
 * Admin Venue Maintenance API — §11.5.
 *
 * GET  /api/admin/venue          — get venue status + config
 * PUT  /api/admin/venue          — toggle pause, update maintenance schedule
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

function str(row: Record<string, unknown>, key: string): string | null {
  const v = row[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

type VenueStatus = {
  isPaused: boolean
  pausedSince: string | null
  maintenanceStart: string | null
  maintenanceEnd: string | null
  maintenanceReason: string | null
  lastUpdatedBy: string | null
  lastUpdatedAt: string | null
}

/* ── GET — read venue status ───────────────────────────── */
export async function GET() {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = getServiceSupabase()

    const { data, error } = await service
      .from('config')
      .select('key, value')
      .in('key', [
        'venue_paused',
        'venue_paused_since',
        'venue_maintenance_start',
        'venue_maintenance_end',
        'venue_maintenance_reason',
        'venue_last_updated_by',
        'venue_last_updated_at',
      ])

    if (error) {
      console.error('[admin/venue] GET query error', { message: error.message })
      return NextResponse.json({
        status: {
          isPaused: false,
          pausedSince: null,
          maintenanceStart: null,
          maintenanceEnd: null,
          maintenanceReason: null,
          lastUpdatedBy: null,
          lastUpdatedAt: null,
        } satisfies VenueStatus,
      })
    }

    const rows = Array.isArray(data) ? data : []
    const configMap: Record<string, unknown> = {}
    for (const r of rows) {
      if (isRecord(r)) {
        const key = str(r as Record<string, unknown>, 'key')
        if (key) configMap[key] = r.value
      }
    }

    const status: VenueStatus = {
      isPaused: configMap.venue_paused === true,
      pausedSince: typeof configMap.venue_paused_since === 'string' ? configMap.venue_paused_since : null,
      maintenanceStart: typeof configMap.venue_maintenance_start === 'string' ? configMap.venue_maintenance_start : null,
      maintenanceEnd: typeof configMap.venue_maintenance_end === 'string' ? configMap.venue_maintenance_end : null,
      maintenanceReason: typeof configMap.venue_maintenance_reason === 'string' ? configMap.venue_maintenance_reason : null,
      lastUpdatedBy: typeof configMap.venue_last_updated_by === 'string' ? configMap.venue_last_updated_by : null,
      lastUpdatedAt: typeof configMap.venue_last_updated_at === 'string' ? configMap.venue_last_updated_at : null,
    }

    return NextResponse.json({ status })
  } catch (err) {
    console.error('[admin/venue] GET error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

/* ── PUT — update venue status ─────────────────────────── */
export async function PUT(req: Request) {
  try {
    const admin = await getAdminData()
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const service = getServiceSupabase()
    const now = new Date().toISOString()

    // ── Build config updates ──────────────────────────────
    const configUpdates: { key: string; value: unknown }[] = []

    // Pause/resume toggle
    if (typeof body.isPaused === 'boolean') {
      configUpdates.push({ key: 'venue_paused', value: body.isPaused })
      configUpdates.push({
        key: 'venue_paused_since',
        value: body.isPaused ? now : null,
      })
    }

    // Maintenance schedule
    if (typeof body.maintenanceStart === 'string' || body.maintenanceStart === null) {
      configUpdates.push({ key: 'venue_maintenance_start', value: body.maintenanceStart })
    }
    if (typeof body.maintenanceEnd === 'string' || body.maintenanceEnd === null) {
      configUpdates.push({ key: 'venue_maintenance_end', value: body.maintenanceEnd })
    }
    if (typeof body.maintenanceReason === 'string' || body.maintenanceReason === null) {
      configUpdates.push({ key: 'venue_maintenance_reason', value: body.maintenanceReason })
    }

    // Metadata
    configUpdates.push({ key: 'venue_last_updated_by', value: admin.email })
    configUpdates.push({ key: 'venue_last_updated_at', value: now })

    if (configUpdates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // ── Upsert each config row ────────────────────────────
    for (const update of configUpdates) {
      const { error } = await service
        .from('config')
        .upsert({ key: update.key, value: update.value }, { onConflict: 'key' })

      if (error) {
        console.error('[admin/venue] config upsert error', { key: update.key, message: error.message })
      }
    }

    // ── Log to admin_action_log ───────────────────────────
    await service.from('admin_action_log').insert({
      admin_user_id: admin.userId,
      admin_email: admin.email,
      action_type: 'venue_maintenance_update',
      target_table: 'config',
      target_id: null,
      before_jsonb: null,
      after_jsonb: JSON.stringify(
        configUpdates.reduce<Record<string, unknown>>((acc, u) => {
          acc[u.key] = u.value
          return acc
        }, {})
      ),
      risk_level: 'medium',
      confirmed_by: admin.userId,
    })

    // ── Return updated status ─────────────────────────────
    const { data: freshData } = await service
      .from('config')
      .select('key, value')
      .in('key', [
        'venue_paused',
        'venue_paused_since',
        'venue_maintenance_start',
        'venue_maintenance_end',
        'venue_maintenance_reason',
        'venue_last_updated_by',
        'venue_last_updated_at',
      ])

    const freshRows = Array.isArray(freshData) ? freshData : []
    const freshMap: Record<string, unknown> = {}
    for (const r of freshRows) {
      if (isRecord(r)) {
        const key = str(r as Record<string, unknown>, 'key')
        if (key) freshMap[key] = r.value
      }
    }

    const status: VenueStatus = {
      isPaused: freshMap.venue_paused === true,
      pausedSince: typeof freshMap.venue_paused_since === 'string' ? freshMap.venue_paused_since : null,
      maintenanceStart: typeof freshMap.venue_maintenance_start === 'string' ? freshMap.venue_maintenance_start : null,
      maintenanceEnd: typeof freshMap.venue_maintenance_end === 'string' ? freshMap.venue_maintenance_end : null,
      maintenanceReason: typeof freshMap.venue_maintenance_reason === 'string' ? freshMap.venue_maintenance_reason : null,
      lastUpdatedBy: typeof freshMap.venue_last_updated_by === 'string' ? freshMap.venue_last_updated_by : null,
      lastUpdatedAt: typeof freshMap.venue_last_updated_at === 'string' ? freshMap.venue_last_updated_at : null,
    }

    return NextResponse.json({ status })
  } catch (err) {
    console.error('[admin/venue] PUT error', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
