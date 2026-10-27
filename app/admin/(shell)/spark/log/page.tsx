import Link from 'next/link'
import { listActionViews, type ActionStatus, type SparkActionView } from '@/lib/spark/actions'

export const dynamic = 'force-dynamic'

const STATUS_LABEL: Record<ActionStatus, string> = {
  pending: '等待確認',
  executed: '已執行',
  rejected: '已拒絕',
  expired: '已過期',
  failed: '失敗',
  undone: '已還原',
}
const FILTERS: { key: ActionStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'executed', label: '已執行' },
  { key: 'undone', label: '已還原' },
  { key: 'pending', label: '等待確認' },
  { key: 'rejected', label: '已拒絕' },
  { key: 'failed', label: '失敗' },
]

function when(iso: string): string {
  return new Date(iso).toLocaleString('zh-HK', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
}

export default async function SparkLogPage({ searchParams }: { searchParams?: Promise<{ status?: string }> | { status?: string } }) {
  const sp = (await searchParams) ?? {}
  const status = FILTERS.find((f) => f.key === sp.status && f.key !== 'all')?.key as ActionStatus | undefined
  const rows: SparkActionView[] = await listActionViews({ limit: 200, status })
  const shown = status === 'pending' ? rows.filter((r) => r.status === 'pending') : rows

  return (
    <div className="sp-log">
      <header className="sp-log-head">
        <div>
          <h1>Spark 操作紀錄</h1>
          <p>Spark 提出的每一項更改、誰確認、結果如何，都記在這裏。更改本身同時寫入 <Link href="/admin/audit">審計記錄</Link>。</p>
        </div>
        <Link href="/admin/spark" className="admin-pill-btn primary">返回 Spark</Link>
      </header>

      <nav className="sp-filters" aria-label="篩選">
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === 'all' ? '/admin/spark/log' : `/admin/spark/log?status=${f.key}`} aria-current={(status ?? 'all') === f.key ? 'page' : undefined}>
            {f.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className="admin-empty">暫時沒有紀錄</p>
      ) : (
        <ul className="sp-log-list">
          {shown.map((r) => (
            <li key={r.id} className={`sp-log-item ${r.status}`}>
              <details>
                <summary>
                  <span className={`sp-status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  <span className="sp-log-sum">
                    <b>{r.summary}</b>
                    <small>{r.label}{r.risk === 'high' ? '・高風險' : ''}</small>
                  </span>
                  <span className="sp-log-meta">
                    <span>{r.adminEmail.split('@')[0]}</span>
                    <time className="admin-num" dateTime={r.createdAt}>{when(r.createdAt)}</time>
                  </span>
                </summary>
                <dl className="sp-preview">
                  {r.preview.map((l, i) => (
                    <div key={`${l.label}-${i}`}>
                      <dt>{l.label}</dt>
                      <dd className={l.tone}>{l.value}</dd>
                    </div>
                  ))}
                  <div><dt>提出</dt><dd>{when(r.createdAt)}</dd></div>
                  {r.executedAt ? <div><dt>執行</dt><dd>{when(r.executedAt)}</dd></div> : null}
                  {r.undoneAt ? <div><dt>還原</dt><dd>{when(r.undoneAt)}</dd></div> : null}
                  {r.error ? <div><dt>錯誤</dt><dd className="minus">{r.error}</dd></div> : null}
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
