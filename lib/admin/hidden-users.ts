import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { str, type Row } from '@/lib/data/adminReadHelpers'
import { writeAdminActionLog } from '@/lib/admin/audit'
import { logSiteError } from '@/lib/errors/log'
import type { HiddenUserRow } from '@/lib/data/getHiddenUserIds'

// Shared by the web route (/api/admin/hidden-users) and the iOS route
// (/api/admin/app/hidden-users) so both always behave identically.
// Reads: any admin. Mutations: super_admin only, audited.

export type HiddenUsersActor = { userId: string; email: string; role: 'super_admin' | 'admin' }
export type HiddenUsersReply = { status: number; body: Record<string, unknown> }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function listHiddenUsers(): Promise<HiddenUsersReply> {
  try {
    const service = getLegacyServiceSupabase()
    const { data: hidden, error } = await service
      .from('admin_hidden_users')
      .select('user_id, reason, created_at')
      .order('created_at', { ascending: false })
    if (error) throw error

    const rows = (hidden ?? []) as Row[]
    const userIds = rows.map((r) => String(r.user_id)).filter((id) => id.length > 0)

    let usersById = new Map<string, Row>()
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await service
        .from('users')
        .select('id, email, display_name, member_code')
        .in('id', userIds)
      if (usersError) throw usersError
      usersById = new Map(((users ?? []) as Row[]).map((u) => [String(u.id), u]))
    }

    const list: HiddenUserRow[] = rows.map((r) => {
      const userId = String(r.user_id)
      const u = usersById.get(userId)
      return {
        userId,
        email: u ? str(u, ['email']) : null,
        displayName: u ? str(u, ['display_name']) : null,
        memberCode: u ? str(u, ['member_code']) : null,
        reason: str(r, ['reason']),
        createdAt: str(r, ['created_at']),
      }
    })

    return { status: 200, body: { success: true, hidden: list } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/hidden-users] GET failed', err)
    await logSiteError('admin.hidden_users', 'error', '隱藏帳戶清單載入失敗', { message })
    return { status: 500, body: { error: `隱藏帳戶清單載入失敗：${message}` } }
  }
}

export async function mutateHiddenUsers(admin: HiddenUsersActor, body: unknown): Promise<HiddenUsersReply> {
  try {
    if (admin.role !== 'super_admin') {
      return { status: 403, body: { error: '只有超級管理員可管理隱藏帳戶' } }
    }
    if (!isRecord(body) || typeof body.action !== 'string') {
      return { status: 400, body: { error: 'Invalid body' } }
    }
    const action = body.action
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    if (reason.length < 5) {
      return { status: 400, body: { error: '原因至少要有 5 個字' } }
    }

    const service = getLegacyServiceSupabase()

    if (action === 'add') {
      const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
      if (!UUID_RE.test(userId)) {
        return { status: 400, body: { error: 'userId 必須是 uuid' } }
      }
      const { data: existing } = await service
        .from('users')
        .select('id, email, display_name')
        .eq('id', userId)
        .maybeSingle()
      if (!existing) return { status: 404, body: { error: '找不到該會員' } }

      const { error: insertError } = await service.from('admin_hidden_users').insert({
        user_id: userId,
        reason,
        created_by: admin.userId,
      })
      if (insertError) {
        // 23505 = unique violation → already hidden. Report it honestly.
        if (insertError.code === '23505') {
          return { status: 409, body: { error: '該帳戶已在隱藏清單' } }
        }
        console.error('[admin/hidden-users] insert failed', insertError)
        return { status: 500, body: { error: '加入隱藏清單失敗' } }
      }

      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'hidden_user_add',
        targetTable: 'admin_hidden_users',
        targetId: userId,
        beforeJsonb: null,
        afterJsonb: { user_id: userId, reason },
        riskLevel: 'medium',
      })
      return { status: 200, body: { success: true, userId } }
    }

    if (action === 'remove') {
      const userId = typeof body.userId === 'string' ? body.userId.trim() : ''
      if (!UUID_RE.test(userId)) {
        return { status: 400, body: { error: 'userId 必須是 uuid' } }
      }
      const { data: existing } = await service
        .from('admin_hidden_users')
        .select('user_id, reason')
        .eq('user_id', userId)
        .maybeSingle()
      if (!existing) return { status: 404, body: { error: '該帳戶不在隱藏清單' } }

      const { error: deleteError } = await service.from('admin_hidden_users').delete().eq('user_id', userId)
      if (deleteError) {
        console.error('[admin/hidden-users] delete failed', deleteError)
        return { status: 500, body: { error: '移出隱藏清單失敗' } }
      }

      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'hidden_user_remove',
        targetTable: 'admin_hidden_users',
        targetId: userId,
        beforeJsonb: { user_id: userId, reason: str(existing as Row, ['reason']) },
        afterJsonb: null,
        riskLevel: 'medium',
      })
      return { status: 200, body: { success: true, userId } }
    }

    if (action === 'add_all_admins') {
      // 「加入所有管理員帳戶」 — every account that has ever been an admin.
      const { data: adminRows, error: adminError } = await service
        .from('admin_users')
        .select('user_id')
      if (adminError) throw adminError

      const ids = Array.from(
        new Set(
          ((adminRows ?? []) as Row[])
            .map((r) => String(r.user_id))
            .filter((id) => UUID_RE.test(id)),
        ),
      )
      if (ids.length === 0) {
        return { status: 200, body: { success: true, added: 0, skipped: 0, userIds: [] } }
      }

      const { data: already } = await service
        .from('admin_hidden_users')
        .select('user_id')
        .in('user_id', ids)
      const alreadySet = new Set(((already ?? []) as Row[]).map((r) => String(r.user_id)))
      const toInsert = ids.filter((id) => !alreadySet.has(id))

      let added = 0
      if (toInsert.length > 0) {
        const { error: bulkError } = await service.from('admin_hidden_users').insert(
          toInsert.map((userId) => ({ user_id: userId, reason, created_by: admin.userId })),
        )
        if (bulkError) {
          console.error('[admin/hidden-users] bulk insert failed', bulkError)
          return { status: 500, body: { error: '加入管理員帳戶失敗' } }
        }
        added = toInsert.length
      }

      await writeAdminActionLog({
        adminUserId: admin.userId,
        adminEmail: admin.email,
        actionType: 'hidden_user_add_all_admins',
        targetTable: 'admin_hidden_users',
        targetId: null,
        beforeJsonb: null,
        afterJsonb: { reason, added, skipped: alreadySet.size, userIds: toInsert },
        riskLevel: 'high',
      })
      return {
        status: 200,
        body: { success: true, added, skipped: alreadySet.size, userIds: toInsert },
      }
    }

    return { status: 400, body: { error: 'Invalid action' } }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[admin/hidden-users] POST failed', err)
    await logSiteError('admin.hidden_users', 'error', '隱藏帳戶變更失敗', { message })
    return { status: 500, body: { error: `隱藏帳戶變更失敗：${message}` } }
  }
}
