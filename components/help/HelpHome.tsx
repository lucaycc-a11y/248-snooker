'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import { HelpContent } from '@/lib/help/content-loader'
import { HELP_PATHS } from '@/lib/help/constants'
import {
  BookingIcon,
  AccountIcon,
  MembershipIcon,
  VenueIcon,
  EntryIcon,
  RulesIcon,
  TechnicalIcon,
  SafetyIcon,
  ContactIcon,
} from './icons'

// Help Center light theme colors
const HELP_COLORS = {
  accent: '#22c55e',
  bg: '#f3f7f4',
  surface: '#fff',
  border: '#e3eae9',
  muted: '#5b6764',
}

interface HelpHomeProps {
  content: HelpContent
}

const iconMap = {
  booking: BookingIcon,
  account: AccountIcon,
  membership: MembershipIcon,
  venue: VenueIcon,
  entry: EntryIcon,
  rules: RulesIcon,
  technical: TechnicalIcon,
  safety: SafetyIcon,
  contact: ContactIcon,
}

export function HelpHome({ content }: HelpHomeProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(HELP_PATHS.search(searchQuery.trim()))
    }
  }

  return (
    <div style={{ background: '#f3f7f4', minHeight: '100vh' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #f3f7f4 0%, #e8f0ea 100%)',
          paddingTop: '80px',
          paddingBottom: '60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 24px',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <h1
            style={{
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 600,
              color: '#111',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            {content.hero.title}
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: '#5b6764',
              textAlign: 'center',
              marginBottom: '40px',
            }}
          >
            {content.hero.subtitle}
          </p>

          {/* Search */}
          <form onSubmit={handleSearch} style={{ maxWidth: '600px', margin: '0 auto' }}>
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={content.hero.searchPlaceholder}
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
        </div>
      </section>

      {/* Topics Grid */}
      <section style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 24px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}
        >
          {content.topics.map((topic) => {
            const Icon = iconMap[topic.icon as keyof typeof iconMap]
            const isContactTile = topic.span === 2

            return (
              <Link
                key={topic.id}
                href={topic.href}
                style={{
                  gridColumn: isContactTile ? 'span 2' : 'span 1',
                  background: isContactTile ? 'linear-gradient(135deg, #f3f7f4 0%, #fff 100%)' : '#fff',
                  borderRadius: '16px',
                  border: '1px solid #e3eae9',
                  padding: isContactTile ? '32px' : '24px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: isContactTile ? 'row' : 'column',
                  alignItems: isContactTile ? 'center' : 'flex-start',
                  gap: isContactTile ? '24px' : '0',
                }}
                className="help-topic-tile"
              >
                {isContactTile && topic.image && (
                  <img
                    src={topic.image.src}
                    srcSet={topic.image.srcset}
                    alt={topic.image.alt}
                    style={{
                      width: '160px',
                      height: '160px',
                      objectFit: 'cover',
                      borderRadius: '12px',
                      flexShrink: 0,
                    }}
                  />
                )}

                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: 'rgba(34, 197, 94, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                    }}
                  >
                    {Icon && <Icon className="help-icon" />}
                  </div>

                  <h3
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#111',
                      marginBottom: '8px',
                    }}
                  >
                    {topic.title}
                  </h3>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#5b6764',
                      lineHeight: 1.6,
                    }}
                  >
                    {topic.description}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Popular Questions */}
      <section
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0 24px 60px',
        }}
      >
        <h2
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: '#111',
            marginBottom: '24px',
          }}
        >
          {content.popularQuestionsTitle}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {content.popularQuestions.map((q, i) => (
            <Link
              key={i}
              href={HELP_PATHS.article(q.topic, q.article)}
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
              className="popular-question"
            >
              {q.question}
            </Link>
          ))}
        </div>
      </section>

      {/* Announcements */}
      {content.announcements.length > 0 && (
        <section
          id="announcements"
          style={{
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '0 24px 80px',
          }}
        >
          <h2
            style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#111',
              marginBottom: '24px',
            }}
          >
            {content.announcementsTitle}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {content.announcements.map((announcement) => (
              <Link
                key={announcement.id}
                href={HELP_PATHS.announcement(announcement.id)}
                style={{
                  padding: '20px 24px',
                  background: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e3eae9',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                className="announcement-item"
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#5b6764',
                    }}
                  >
                    {new Date(announcement.date).toLocaleDateString('zh-HK', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                </div>
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#111',
                    marginBottom: '8px',
                  }}
                >
                  {announcement.title}
                </h3>
                <p
                  style={{
                    fontSize: '14px',
                    color: '#5b6764',
                    lineHeight: 1.6,
                  }}
                >
                  {announcement.summary}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <style jsx>{`
        .help-topic-tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
          border-color: ${HELP_COLORS.accent};
        }

        .help-icon {
          width: 24px;
          height: 24px;
          color: ${HELP_COLORS.accent};
        }

        .popular-question:hover {
          border-color: ${HELP_COLORS.accent};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .announcement-item:hover {
          border-color: ${HELP_COLORS.accent};
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        @media (max-width: 768px) {
          .help-topic-tile[style*='span 2'] {
            grid-column: span 1 !important;
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  )
}
