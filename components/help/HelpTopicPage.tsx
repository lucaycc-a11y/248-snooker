'use client'

import { Link } from '@/i18n/navigation'
import { HelpTopicData } from '@/lib/help/content-loader'
import { useTranslations } from 'next-intl'
import { HELP_PATHS } from '@/lib/help/constants'

// Help Center light theme colors
const HELP_COLORS = {
  accent: '#22c55e',
  bg: '#f3f7f4',
  surface: '#fff',
  border: '#e3eae9',
  muted: '#5b6764',
}

interface HelpTopicPageProps {
  topicId: string
  topicData: HelpTopicData
}

export function HelpTopicPage({ topicId, topicData }: HelpTopicPageProps) {
  const t = useTranslations('help')
  return (
    <div style={{ background: '#f3f7f4', minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '24px 24px 0',
        }}
      >
        <nav style={{ fontSize: '14px', color: '#5b6764', marginBottom: '24px' }}>
          <Link href={HELP_PATHS.home} style={{ color: HELP_COLORS.accent, textDecoration: 'none' }}>
            {t('breadcrumb.home')}
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>{topicData.title}</span>
        </nav>
      </div>

      {/* Header */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px 40px',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(28px, 4vw, 36px)',
            fontWeight: 600,
            color: '#111',
            marginBottom: '12px',
          }}
        >
          {topicData.title}
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: '#5b6764',
            lineHeight: 1.6,
          }}
        >
          {topicData.description}
        </p>
      </section>

      {/* Articles */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {topicData.articles
            .filter((a) => a.published)
            .map((article) => (
              <Link
                key={article.id}
                href={HELP_PATHS.article(topicId, article.id)}
                style={{
                  padding: '20px 24px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e3eae9',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                className="article-row"
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#111',
                    marginBottom: '6px',
                  }}
                >
                  {article.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#5b6764',
                    lineHeight: 1.6,
                  }}
                >
                  {article.summary}
                </p>
              </Link>
            ))}
        </div>
      </section>

      <style jsx>{`
        .article-row:hover {
          border-color: ${HELP_COLORS.accent};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </div>
  )
}
