import { getLegacyServiceSupabase } from '@/lib/supabase/legacy'
import { getHiddenUserList } from '@/lib/data/getHiddenUserIds'

export type Recipient = { email: string; name: string }
export type AudienceKind = 'test' | 'members' | 'all'

export const MAX_RECIPIENTS = 1000
const EMAIL_RE = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/

type UserRow = {
  email: string | null
  display_name: string | null
  member_code: string | null
  is_deleted: boolean | null
  is_blacklisted: boolean | null
  id: string
}

function toRecipient(u: UserRow): Recipient | null {
  const email = (u.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return null
  return { email, name: (u.display_name ?? '').trim() || '會員' }
}

/** Who a send would reach. `all` skips deleted, blacklisted and hidden/test accounts. */
export async function resolveAudience(
  kind: AudienceKind,
  input: { adminEmail: string; codes?: string[] },
): Promise<{ recipients: Recipient[]; error?: string }> {
  if (kind === 'test') {
    const email = input.adminEmail.trim().toLowerCase()
    return EMAIL_RE.test(email) ? { recipients: [{ email, name: 'Luca' }] } : { recipients: [], error: '找不到你的電郵地址' }
  }
  const service = getLegacyServiceSupabase()
  if (kind === 'members') {
    const codes = Array.from(new Set((input.codes ?? []).map((c) => c.trim()).filter(Boolean))).slice(0, 200)
    if (codes.length === 0) return { recipients: [], error: '請先揀會員' }
    const { data, error } = await service
      .from('users')
      .select('id, email, display_name, member_code, is_deleted, is_blacklisted')
      .in('member_code', codes)
    if (error) return { recipients: [], error: '讀取會員失敗' }
    const out: Recipient[] = []
    for (const u of (data ?? []) as unknown as UserRow[]) {
      if (u.is_deleted === true) continue
      const r = toRecipient(u)
      if (r) out.push(r)
    }
    return { recipients: out }
  }
  // all members
  let hidden: Set<string>
  try {
    hidden = (await getHiddenUserList()).ids
  } catch {
    return { recipients: [], error: '隱藏帳戶清單載入失敗，為免寄到測試帳戶，已停止' }
  }
  const { data, error } = await service
    .from('users')
    .select('id, email, display_name, member_code, is_deleted, is_blacklisted')
    .not('email', 'is', null)
    .limit(MAX_RECIPIENTS + 1)
  if (error) return { recipients: [], error: '讀取會員失敗' }
  const seen = new Set<string>()
  const out: Recipient[] = []
  for (const u of (data ?? []) as unknown as UserRow[]) {
    if (u.is_deleted === true || u.is_blacklisted === true || hidden.has(u.id)) continue
    const r = toRecipient(u)
    if (!r || seen.has(r.email)) continue
    seen.add(r.email)
    out.push(r)
  }
  if (out.length > MAX_RECIPIENTS) return { recipients: [], error: `收件人超過 ${MAX_RECIPIENTS}，請分批發送` }
  return { recipients: out }
}
