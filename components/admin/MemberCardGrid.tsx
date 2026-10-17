'use client'

/**
 * MemberCardGrid — the prototype's `.mgrid` / `.mcard`, one-for-one.
 *
 * Card anatomy (space8-admin.html `memResults()` grid branch):
 *   mtop   → initial avatar + flag tags
 *   mn     → display name
 *   ms     → member code (mono)
 *   mbox   → 積分 / Credit panel on the page background
 *   ms     → phone
 *
 * Avatar variant is the prototype's `(name.charCodeAt(0) || 0) % 3`, not a
 * string hash — the three fills have to land on the same people as the mock.
 */

import { useRouter } from 'next/navigation'
import { type AdminMemberRow } from '@/lib/data/getAdminMembers'
import { money } from '@/lib/admin/today'

/** Prototype `memBadges()` — only these two, in this order. */
function memberBadges(m: AdminMemberRow): React.ReactNode {
  return (
    <>
      {m.isBlacklisted ? (
        <span className="admin-tag bad" data-cms-key="admin.members.badge_blacklist">
          黑名單
        </span>
      ) : null}
      {m.needsManualPhoneReverify ? (
        <span className="admin-tag warn" data-cms-key="admin.members.badge_reverify">
          待重新驗證電話
        </span>
      ) : null}
    </>
  )
}

type Props = {
  members: AdminMemberRow[]
  onOpen?: (id: string) => void
}

export default function MemberCardGrid({ members, onOpen }: Props) {
  const router = useRouter()

  return (
    <div className="admin-mgrid">
      {members.map((m) => {
        const name = m.displayName || m.memberCode || m.email || m.id.slice(0, 8)
        const initial = (name || '?').slice(0, 1).toUpperCase()
        const av = `admin-av${(name.charCodeAt(0) || 0) % 3}`

        return (
          <button
            key={m.id}
            type="button"
            className="admin-mcard"
            onClick={() => (onOpen ? onOpen(m.id) : router.push(`/admin/members/${m.id}`))}
          >
            <span className="admin-mtop">
              <span className={`admin-av ${av}`} aria-hidden>
                {initial}
              </span>
              <span className="admin-mflags">{memberBadges(m)}</span>
            </span>
            <span className="admin-mn">{name}</span>
            <span className="admin-ms admin-mono">{m.memberCode ?? ''}</span>
            <span className="admin-mbox">
              <span>
                <small data-cms-key="admin.members.points">積分</small>
                <b className="admin-num">{m.points}</b>
              </span>
              <span>
                <small data-cms-key="admin.members.credit">Credit</small>
                <b className="admin-num">{money(m.credits)}</b>
              </span>
            </span>
            <span className="admin-ms">{m.phone ?? ''}</span>
          </button>
        )
      })}

      {members.length === 0 && (
        <div className="admin-empty" data-cms-key="admin.members.empty">
          找不到會員
        </div>
      )}
    </div>
  )
}
