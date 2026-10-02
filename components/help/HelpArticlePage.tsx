'use client'

import { useState } from 'react'
import { Link } from '@/i18n/navigation'
import { HelpArticle } from '@/lib/help/content-loader'
import { HELP_PATHS } from '@/lib/help/constants'
import { Markdown } from './Markdown'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

// Help Center light theme colors
const HELP_COLORS = {
  accent: '#22c55e',
  bg: '#f3f7f4',
  surface: '#fff',
  border: '#e3eae9',
  muted: '#5b6764',
}

interface HelpArticlePageProps {
  topicId: string
  topicTitle: string
  article: HelpArticle
  allArticles: HelpArticle[]
}

export function HelpArticlePage({ topicId, topicTitle, article, allArticles }: HelpArticlePageProps) {
  const [feedbackState, setFeedbackState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [selectedFeedback, setSelectedFeedback] = useState<boolean | null>(null)

  const handleFeedback = async (helpful: boolean) => {
    if (feedbackState !== 'idle') return

    setSelectedFeedback(helpful)
    setFeedbackState('submitting')

    try {
      const res = await fetch('/api/help-center/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleId: `${topicId}/${article.id}`,
          helpful,
        }),
      })

      if (res.ok) {
        setFeedbackState('success')
      } else {
        setFeedbackState('error')
      }
    } catch {
      setFeedbackState('error')
    }
  }

  return (
    <div style={{ background: '#f3f7f4', minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: '14px', color: '#5b6764', marginBottom: '24px' }}>
          <Link href={HELP_PATHS.home} style={{ color: HELP_COLORS.accent, textDecoration: 'none' }}>
            幫助中心
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <Link
            href={HELP_PATHS.topic(topicId)}
            style={{ color: HELP_COLORS.accent, textDecoration: 'none' }}
          >
            {topicTitle}
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>{article.title}</span>
        </nav>

        {/* Article */}
        <article
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e3eae9',
            padding: '40px',
            marginBottom: '32px',
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(24px, 4vw, 32px)',
              fontWeight: 600,
              color: '#111',
              marginBottom: '12px',
            }}
          >
            {article.title}
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: '#5b6764',
              lineHeight: 1.6,
              marginBottom: '32px',
              paddingBottom: '32px',
              borderBottom: '1px solid #e3eae9',
            }}
          >
            {article.summary}
          </p>

          <div className="article-content">
            <Markdown content={article.content} />
          </div>
        </article>

        {/* Feedback */}
        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            border: '1px solid #e3eae9',
            padding: '32px',
            marginBottom: '32px',
          }}
        >
          {feedbackState === 'success' ? (
            <p style={{ fontSize: '15px', color: '#111', textAlign: 'center' }}>
              感謝你的回饋！
            </p>
          ) : (
            <>
              <p
                style={{
                  fontSize: '15px',
                  color: '#111',
                  marginBottom: '16px',
                  textAlign: 'center',
                }}
              >
                這篇文章有幫助嗎？
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={() => handleFeedback(true)}
                  disabled={feedbackState !== 'idle'}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #e3eae9',
                    background: selectedFeedback === true ? HELP_COLORS.accent : '#fff',
                    color: selectedFeedback === true ? '#fff' : '#111',
                    fontSize: '14px',
                    cursor: feedbackState === 'idle' ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                  className="feedback-btn"
                >
                  <ThumbsUp size={16} />
                  有幫助
                </button>
                <button
                  onClick={() => handleFeedback(false)}
                  disabled={feedbackState !== 'idle'}
                  style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: '1px solid #e3eae9',
                    background: selectedFeedback === false ? '#dc2626' : '#fff',
                    color: selectedFeedback === false ? '#fff' : '#111',
                    fontSize: '14px',
                    cursor: feedbackState === 'idle' ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                  }}
                  className="feedback-btn"
                >
                  <ThumbsDown size={16} />
                  沒有幫助
                </button>
              </div>
              {feedbackState === 'error' && (
                <p
                  style={{
                    fontSize: '13px',
                    color: '#dc2626',
                    marginTop: '12px',
                    textAlign: 'center',
                  }}
                >
                  提交失敗，請稍後再試
                </p>
              )}
            </>
          )}
        </div>

        {/* Related Articles */}
        {allArticles.length > 1 && (
          <div>
            <h2
              style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#111',
                marginBottom: '16px',
              }}
            >
              其他相關文章
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allArticles
                .filter((a) => a.id !== article.id)
                .slice(0, 5)
                .map((a) => (
                  <Link
                    key={a.id}
                    href={HELP_PATHS.article(topicId, a.id)}
                    style={{
                      padding: '16px 20px',
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e3eae9',
                      textDecoration: 'none',
                      color: '#111',
                      fontSize: '15px',
                      transition: 'all 0.2s',
                    }}
                    className="related-article"
                  >
                    {a.title}
                  </Link>
                ))}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .article-content {
          font-size: 15px;
          line-height: 1.8;
          color: #111;
        }

        .article-content h2 {
          font-size: 22px;
          font-weight: 600;
          color: #111;
          margin: 32px 0 16px;
        }

        .article-content h3 {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 24px 0 12px;
        }

        .article-content p {
          margin: 16px 0;
        }

        .article-content ul,
        .article-content ol {
          margin: 16px 0;
          padding-left: 24px;
        }

        .article-content li {
          margin: 8px 0;
        }

        .article-content a {
          color: ${HELP_COLORS.accent};
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: border-color 0.2s;
        }

        .article-content a:hover {
          border-bottom-color: ${HELP_COLORS.accent};
        }

        .article-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 24px 0;
          font-size: 14px;
        }

        .article-content th,
        .article-content td {
          padding: 12px;
          text-align: left;
          border: 1px solid #e3eae9;
        }

        .article-content th {
          background: #f3f7f4;
          font-weight: 600;
          color: #111;
        }

        .article-content code {
          background: #f3f7f4;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New',
            monospace;
        }

        .article-content pre {
          background: #f3f7f4;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          margin: 24px 0;
        }

        .article-content pre code {
          background: none;
          padding: 0;
        }

        .article-content hr {
          border: none;
          border-top: 1px solid #e3eae9;
          margin: 32px 0;
        }

        .feedback-btn:hover:not(:disabled) {
          border-color: ${HELP_COLORS.accent};
        }

        .related-article:hover {
          border-color: ${HELP_COLORS.accent};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </div>
  )
}
