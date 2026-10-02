'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { HELP_PATHS } from '@/lib/help/constants'
import Fuse from 'fuse.js'

// Help Center light theme colors
const HELP_COLORS = {
  accent: '#22c55e',
  bg: '#f3f7f4',
  surface: '#fff',
  border: '#e3eae9',
  muted: '#5b6764',
}

interface SearchableItem {
  type: 'article' | 'announcement'
  title: string
  content: string
  url: string
}

interface HelpSearchPageProps {
  searchableItems: SearchableItem[]
  initialQuery: string
}

export function HelpSearchPage({ searchableItems, initialQuery }: HelpSearchPageProps) {
  const t = useTranslations('help')
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<SearchableItem[]>([])
  const router = useRouter()

  // Initialize Fuse
  const fuse = useMemo(
    () =>
      new Fuse(searchableItems, {
        keys: [
          { name: 'title', weight: 2 },
          { name: 'content', weight: 1 },
        ],
        threshold: 0.3,
        includeScore: true,
      }),
    [searchableItems]
  )

  // Perform search
  useEffect(() => {
    if (query.trim()) {
      const searchResults = fuse.search(query.trim())
      setResults(searchResults.map((r) => r.item))
    } else {
      setResults([])
    }
  }, [query, fuse])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(HELP_PATHS.search(query.trim()))
    }
  }

  return (
    <div style={{ background: HELP_COLORS.bg, minHeight: '100vh' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
        {/* Breadcrumb */}
        <nav style={{ fontSize: '14px', color: HELP_COLORS.muted, marginBottom: '24px' }}>
          <Link href={HELP_PATHS.home} style={{ color: HELP_COLORS.accent, textDecoration: 'none' }}>
            {t('breadcrumb.home')}
          </Link>
          <span style={{ margin: '0 8px' }}>/</span>
          <span>{t('breadcrumb.search')}</span>
        </nav>

        {/* Search Form */}
        <form onSubmit={handleSearch} style={{ marginBottom: '32px' }}>
          <div
            style={{
              position: 'relative',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e3eae9',
              overflow: 'hidden',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              autoFocus
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '16px',
                border: 'none',
                outline: 'none',
                color: '#111',
                background: 'transparent',
              }}
            />
          </div>
        </form>

        {/* Results */}
        {query.trim() && (
          <>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: '#111',
                marginBottom: '16px',
              }}
            >
              {t('search.results_count', { count: results.length })}
            </h1>

            {results.length === 0 ? (
              <div
                style={{
                  padding: '40px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e3eae9',
                  textAlign: 'center',
                }}
              >
                <p style={{ fontSize: '15px', color: '#5b6764' }}>
                  {t('search.no_results')}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {results.map((item, idx) => (
                  <Link
                    key={`${item.type}-${idx}`}
                    href={item.url}
                    style={{
                      padding: '20px 24px',
                      background: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e3eae9',
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                    className="search-result"
                  >
                    {item.type === 'announcement' && (
                      <div style={{ marginBottom: '8px' }}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#fff',
                            background: HELP_COLORS.accent,
                            padding: '2px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          {t('announcement.badge')}
                        </span>
                      </div>
                    )}
                    <h3
                      style={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#111',
                        marginBottom: '8px',
                      }}
                    >
                      {item.title}
                    </h3>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}

        {!query.trim() && (
          <div
            style={{
              padding: '40px',
              background: '#fff',
              borderRadius: '12px',
              border: '1px solid #e3eae9',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: '15px', color: '#5b6764' }}>
              {t('search.empty_state')}
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        .search-result:hover {
          border-color: ${HELP_COLORS.accent};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
      `}</style>
    </div>
  )
}
