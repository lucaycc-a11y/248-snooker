import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'

// 封枱 (maintenance_log) — shared by /api/admin/maintenance-log and the iOS API.
// `table_number: null` = all tables. Every change writes audit_log.

export type BlockActor = { userId: string; email: string }
export type BlockReply = { status: number; body: Record<string, unknown> }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const COLS = 'id, date, start_time, end_time, table_number, reason, created_by'

export async function listBlocks(date: string | null): Promise<BlockReply> {
  try {
    let query = getLegacyServiceSupabase()
      .from('maintenance_log')
      .select(COLS)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true })
    if (date) query = query.eq('date', date)
    const { data, error } = await query
    if (error) return { status: 500, body: { error: error.message } }
    return { status: 200, body: { blocks: data ?? [] } }
  } catch (e) {
    return { status: 500, body: { error: e instanceof Error ? e.message : 'Unexpected error' } }
  }
}

export async function createBlock(admin: BlockActor, body: unknown): Promise<BlockReply> {
  try {
    if (!isRecord(body) || typeof body.date !== 'string' || body.date.trim() === '') {
      return { status: 400, body: { error: 'date is required' } }
    }
    const tableNumber =
      typeof body.table_number === 'number' && Number.isInteger(body.table_number) && body.table_number > 0
        ? body.table_number
        : null
    const startTime = typeof body.start_time === 'string' && body.start_time.trim() !== '' ? body.start_time : null
    const endTime = typeof body.end_time === 'string' && body.end_time.trim() !== '' ? body.end_time : null
    if ((startTime && !endTime) || (!startTime && endTime)) {
      return { status: 400, body: { error: 'start_time and end_time must be provided together' } }
    }
    if (startTime && endTime && startTime >= endTime) {
      return { status: 400, body: { error: 'start_time must be before end_time' } }
    }
    const reason = typeof body.reason === 'string' && body.reason.trim() !== '' ? body.reason.trim() : null

    const supabase = getLegacyServiceSupabase()
    const { data, error } = await supabase
      .from('maintenance_log')
      .insert({
        date: body.date,
        start_time: startTime,
        end_time: endTime,
        table_number: tableNumber,
        reason,
        created_by: admin.userId,
      })
      .select(COLS)
      .single()
    if (error) return { status: 500, body: { error: error.message } }

    await supabase.from('audit_log').insert({
      action: 'maintenance.create',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'maintenance_log',
      target_id: data.id,
      before_value: null,
      after_value: { date: body.date, start_time: startTime, end_time: endTime, table_number: tableNumber, reason },
    })
    return { status: 200, body: { ok: true, block: data } }
  } catch (e) {
    return { status: 500, body: { error: e instanceof Error ? e.message : 'Unexpected error' } }
  }
}

export async function deleteBlock(admin: BlockActor, id: string): Promise<BlockReply> {
  try {
    if (!id) return { status: 400, body: { error: 'Missing id' } }
    const supabase = getLegacyServiceSupabase()
    const { data: before, error: readError } = await supabase
      .from('maintenance_log')
      .select('id, date, start_time, end_time, table_number, reason')
      .eq('id', id)
      .single()
    if (readError || !before) return { status: 404, body: { error: 'Not found' } }

    const { error: deleteError } = await supabase.from('maintenance_log').delete().eq('id', id)
    if (deleteError) return { status: 500, body: { error: deleteError.message } }

    await supabase.from('audit_log').insert({
      action: 'maintenance.remove',
      admin_email: admin.email,
      admin_user_id: admin.userId,
      target_table: 'maintenance_log',
      target_id: id,
      before_value: before,
      after_value: null,
    })
    return { status: 200, body: { ok: true } }
  } catch (e) {
    return { status: 500, body: { error: e instanceof Error ? e.message : 'Unexpected error' } }
  }
}
