'use client'

/**
 * MemberDetailSheet — the prototype's `drMember()` / `sheet()`.
 *
 * Right drawer on desktop, bottom sheet on phone. Opens from a member row with
 * `S.mtab = 'info'`, so 資料 is always the landing tab. The four tabs are the
 * prototype's own: 資料 | 預約 | 積分與錢包額度 | 通知.
 *
 * Only the 資料 tab carries live data here — it is entirely derivable from
 * `AdminMemberRow`. The other three render the prototype's empty states until
 * their read APIs land; they must not invent rows.
 */

import { useEffect, useState } from 'react'
import { Lock, X } from 'lucide-react'
import { type AdminMemberRow } from '@/lib/data/getAdminMembers'
import { money } from '@/lib/admin/today'

type DetailTab = 'info' | 'bk' | 'led' | 'nt'

function Seg({
  value,
  options,
  onChange,
  label,
}: {
  value: DetailTab
  options: { key: DetailTab; label: string; cmsKey: string }[]
  onChange: (next: DetailTab) => void
  label: string
}) {
  return (
    <div className="admin-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          data-cms-key={o.cmsKey}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function LockTag() {
  return (
    <span className="admin-lock" data-cms-key="admin.members.super_only">
      <Lock size={13} aria-hidden />
      僅限超級管理員
    </span>
  )
}

type Props = {
  member: AdminMemberRow
  isSuperAdmin: boolean
  onClose: () => void
}

export default function MemberDetailSheet({ member, isSuperAdmin, onClose }: Props) {
  const [tab, setTab] = useState<DetailTab>('info')

  // Escape closes, matching the prototype's close-drawer affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const name = member.displayName || member.memberCode || member.email || member.id.slice(0, 8)
  const since = member.createdAt ? member.createdAt.slice(0, 10) : '—'

  return (
    <div className="admin-ov" onClick={onClose}>
      <div
        className="admin-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-sh-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{name}</h2>
            {/* Prototype `sheet()` sub: mono code + badges, 6px under the title. */}
            <div className="admin-row" style={{ marginTop: 6 }}>
              <span className="admin-cell-sub admin-mono">{member.memberCode ?? ''}</span>
              {member.isBlacklisted ? (
                <span className="admin-tag bad" data-cms-key="admin.members.badge_blacklist">
                  黑名單
                </span>
              ) : null}
              {member.needsManualPhoneReverify ? (
                <span className="admin-tag warn" data-cms-key="admin.members.badge_reverify">
                  待重新驗證電話
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="關閉"
            onClick={onClose}
            data-cms-key="admin.close"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className="admin-sh-body">
          <Seg
            value={tab}
            onChange={setTab}
            label="會員資料分頁"
            options={[
              { key: 'info', label: '資料', cmsKey: 'admin.members.dtab_info' },
              { key: 'bk', label: '預約', cmsKey: 'admin.members.dtab_bk' },
              { key: 'led', label: '積分與錢包額度', cmsKey: 'admin.members.dtab_led' },
              { key: 'nt', label: '通知', cmsKey: 'admin.members.dtab_nt' },
            ]}
          />

          {tab === 'info' ? (
            <>
              {/* Rapport `.stat` is a flex row — Bebas numeral, then label. */}
              <div className="admin-grid2">
                <div className="admin-stat">
                  <b className="admin-num">{member.points}</b>
                  <span data-cms-key="admin.members.stat_points">積分</span>
                </div>
                <div className="admin-stat">
                  <b className="admin-num">{money(member.credits)}</b>
                  <span data-cms-key="admin.members.stat_credit">錢包額度</span>
                </div>
              </div>

              <div className="admin-sect">
                <h3 data-cms-key="admin.members.sect_info">資料</h3>
                <dl className="admin-kv">
                  <dt data-cms-key="admin.members.field_name">名稱</dt>
                  <dd>
                    {name}{' '}
                    <button
                      type="button"
                      className="admin-btn sm"
                      data-cms-key="admin.members.edit_name"
                    >
                      修改
                    </button>
                  </dd>

                  <dt data-cms-key="admin.members.field_phone">電話</dt>
                  <dd>
                    {member.phone ?? ''}{' '}
                    {member.isPhoneVerified ? (
                      <span className="admin-tag" data-cms-key="admin.members.phone_verified">
                        已驗證
                      </span>
                    ) : (
                      <span className="admin-tag warn" data-cms-key="admin.members.phone_unverified">
                        未驗證
                      </span>
                    )}
                  </dd>

                  <dt data-cms-key="admin.members.field_email">電郵</dt>
                  <dd data-cms-key="admin.members.no_email">{member.email || '沒有電郵'}</dd>

                  {/* Prototype puts the contact editor on an empty label row so
                      it sits under the value column, not beside a field name. */}
                  <dt />
                  <dd>
                    <button
                      type="button"
                      className="admin-btn sm"
                      disabled={!isSuperAdmin}
                      data-cms-key="admin.members.edit_contact"
                    >
                      修改電話與電郵
                    </button>{' '}
                    {isSuperAdmin ? null : <LockTag />}
                  </dd>

                  <dt data-cms-key="admin.members.field_code">會員編號</dt>
                  <dd>
                    <span className="admin-mono">{member.memberCode ?? ''}</span>
                  </dd>

                  <dt data-cms-key="admin.members.field_since">加入日期</dt>
                  <dd>{since}</dd>
                </dl>
              </div>

              {member.needsManualPhoneReverify ? (
                <div className="admin-note warn">
                  <span data-cms-key="admin.members.reverify_note">
                    此會員需要手動重新驗證電話。完成後請標記已處理。
                  </span>
                  <div className="admin-row" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="admin-btn sm"
                      data-cms-key="admin.members.reverify_done"
                    >
                      標記已處理
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="admin-sect">
                <h3 data-cms-key="admin.members.sect_actions">帳戶操作</h3>
                <div className="admin-row">
                  <button
                    type="button"
                    className="admin-btn sm"
                    data-cms-key="admin.members.adj_points"
                  >
                    調整積分
                  </button>
                  <button
                    type="button"
                    className="admin-btn sm"
                    data-cms-key="admin.members.adj_credit"
                  >
                    調整錢包額度
                  </button>
                  <button type="button" className="admin-btn sm" data-cms-key="admin.members.send_inbox">
                    發送 inbox 訊息
                  </button>
                  <button
                    type="button"
                    className={member.isBlacklisted ? 'admin-btn sm' : 'admin-btn sm danger'}
                    data-cms-key={
                      member.isBlacklisted
                        ? 'admin.members.unblacklist'
                        : 'admin.members.blacklist'
                    }
                  >
                    {member.isBlacklisted ? '解除黑名單' : '加入黑名單'}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {tab === 'bk' ? (
            <div className="admin-empty" data-cms-key="admin.members.bk_empty">
              沒有預約記錄
            </div>
          ) : null}

          {tab === 'led' ? (
            <>
              <div className="admin-sect">
                <h3 data-cms-key="admin.members.sect_credit_ledger">錢包額度</h3>
                <p className="admin-muted" data-cms-key="admin.members.ledger_empty">
                  沒有流水
                </p>
              </div>
              <div className="admin-sect">
                <h3 data-cms-key="admin.members.sect_points_ledger">積分</h3>
                <p className="admin-muted" data-cms-key="admin.members.ledger_empty">
                  沒有流水
                </p>
              </div>
            </>
          ) : null}

          {tab === 'nt' ? (
            <div className="admin-empty" data-cms-key="admin.members.nt_empty">
              沒有通知
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
