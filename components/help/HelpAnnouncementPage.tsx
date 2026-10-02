'use client'

import { Link } from '@/i18n/navigation'
import type { HelpAnnouncement } from '@/lib/help/content-loader'
import { Markdown } from './Markdown'

// Help Center light theme colors
const HELP_COLORS = {
  accent: '#22c55e',
  bg: '#f3f7f4',
  surface: '#fff',
  border: '#e3eae9',
  muted: '#5b6764',
}

interface HelpAnnouncementPageProps {
  announcement: HelpAnnouncement
}

export function HelpAnnouncementPage({ announcement }: HelpAnnouncementPageProps) {
  return (
    <div style={{ background: HELP_COLORS.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: '14px', color: HELP_COLORS.muted, marginBottom: '24px' }}>
          <Link href="/help" style={{ color: HELP_COLORS.accent, textDecoration: 'none' }}>
            幫助中心
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <Link
            href="/help#announcements"
            style={{ color: HELP_COLORS.accent, textDecoration: 'none' }}
          >
            公告
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>{announcement.title}</span>
        </nav>

        {/* Announcement */}
        <article
          style={{
            background: HELP_COLORS.surface,
            borderRadius: '16px',
            border: `1px solid ${HELP_COLORS.border}`,
            padding: '40px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              display: 'inline-block',
              fontSize: '12px',
              color: '#fff',
              background: HELP_COLORS.accent,
              padding: '4px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
            }}
          >
            公告
          </div>

          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 600,
              color: '#111',
              marginBottom: '12px',
            }}
          >
            {announcement.title}
          </h1>

          <div
            style={{
              fontSize: '14px',
              color: HELP_COLORS.muted,
              marginBottom: '24px',
              paddingBottom: '24px',
              borderBottom: `1px solid ${HELP_COLORS.border}`,
            }}
          >
            {new Date(announcement.date).toLocaleDateString('zh-HK', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>

          <p
            style={{
              fontSize: '16px',
              color: HELP_COLORS.muted,
              lineHeight: 1.6,
              marginBottom: '32px',
              paddingBottom: '32px',
              borderBottom: `1px solid ${HELP_COLORS.border}`,
            }}
          >
            {announcement.summary}
          </p>

          <div className="announcement-content">
            <Markdown content={announcement.content} />
          </div>
        </article>

        {/* Back Link */}
        <Link
          href="/help#announcements"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            background: HELP_COLORS.surface,
            borderRadius: '8px',
            border: `1px solid ${HELP_COLORS.border}`,
            textDecoration: 'none',
            color: '#111',
            fontSize: '15px',
            transition: 'all 0.2s',
          }}
          className="back-link"
        >
          ← 返回幫助中心
        </Link>
      </div>

      <style jsx global>{`
        .announcement-content {
          font-size: 15px;
          line-height: 1.8;
          color: #111;
        }

        .announcement-content h2 {
          font-size: 22px;
          font-weight: 600;
          color: #111;
          margin: 32px 0 16px;
        }

        .announcement-content h3 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 24px 0 12px;
        }

        .announcement-content p {
          margin: 16px 0;
        }

        .announcement-content ul,
        .announcement-content ol {
          margin: 16px 0;
          padding-left: 24px;
        }

        .announcement-content li {
          margin: 8px 0;
        }

        .announcement-content a {
          color: ${HELP_COLORS.accent};
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .announcement-content a:hover {
          border-bottom-color: ${HELP_COLORS.accent};
        }

        .announcement-content strong {
          font-weight: 600;
          color: #111;
        }

        .announcement-content hr {
          border: none;
          border-top: 1px solid ${HELP_COLORS.border};
          margin: 32px 0;
        }

        .back-link:hover {
          border-color: ${HELP_COLORS.accent};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </div>
  )
}
