'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'

// ════════════════════════════════════════════════════════════════════════════
// HelpCenter — P7: FAQ, contact info, and support resources
// Collapsible FAQ sections with search
// ════════════════════════════════════════════════════════════════════════════

type FAQItem = {
  question: string
  answer: string
  category: 'booking' | 'payment' | 'points' | 'account' | 'general'
}

export function HelpCenter() {
  const t = useTranslations('member.help')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const faqs: FAQItem[] = [
    {
      question: t('faq.how_to_book.question'),
      answer: t('faq.how_to_book.answer'),
      category: 'booking',
    },
    {
      question: t('faq.cancel_booking.question'),
      answer: t('faq.cancel_booking.answer'),
      category: 'booking',
    },
    {
      question: t('faq.earn_points.question'),
      answer: t('faq.earn_points.answer'),
      category: 'points',
    },
    {
      question: t('faq.redeem_points.question'),
      answer: t('faq.redeem_points.answer'),
      category: 'points',
    },
    {
      question: t('faq.tier_upgrade.question'),
      answer: t('faq.tier_upgrade.answer'),
      category: 'points',
    },
    {
      question: t('faq.payment_methods.question'),
      answer: t('faq.payment_methods.answer'),
      category: 'payment',
    },
    {
      question: t('faq.birthday_perk.question'),
      answer: t('faq.birthday_perk.answer'),
      category: 'points',
    },
    {
      question: t('faq.change_password.question'),
      answer: t('faq.change_password.answer'),
      category: 'account',
    },
  ]

  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch =
      searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || faq.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = ['all', 'booking', 'points', 'payment', 'account', 'general']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white">{t('title')}</h2>
        <p className="mt-2 text-white/60">{t('subtitle')}</p>
      </div>

      {/* Search */}
      <div className="mx-auto max-w-2xl">
        <div className="relative">
          <input
            type="text"
            placeholder={t('search_placeholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-full bg-white/10 px-6 py-4 pl-12 text-white placeholder-white/40 backdrop-blur-xl focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <svg
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`font-label rounded-full px-6 py-2 text-sm transition-all ${
              selectedCategory === cat
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
            }`}
          >
            {t(`categories.${cat}`)}
          </button>
        ))}
      </div>

      {/* FAQ List */}
      <div className="mx-auto max-w-3xl space-y-3">
        {filteredFaqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white/5 py-16 text-center backdrop-blur">
            <span className="text-6xl opacity-30">🔍</span>
            <p className="mt-4 text-white/60">{t('no_results')}</p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredFaqs.map((faq, index) => (
              <FAQItem
                key={index}
                faq={faq}
                isExpanded={expandedId === `faq-${index}`}
                onToggle={() => setExpandedId(expandedId === `faq-${index}` ? null : `faq-${index}`)}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Contact Section */}
      <div className="mx-auto mt-12 max-w-3xl space-y-4">
        <h3 className="text-center text-xl font-bold text-white">{t('still_need_help')}</h3>

        <div className="grid gap-4 md:grid-cols-2">
          <ContactCard
            icon="📧"
            title={t('contact.email')}
            content="support@space8.com.hk"
            href="mailto:support@space8.com.hk"
          />
          <ContactCard
            icon="📞"
            title={t('contact.phone')}
            content="+852 1234 5678"
            href="tel:+85212345678"
          />
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-6 text-center backdrop-blur-xl">
          <div className="text-4xl">⏰</div>
          <h4 className="mt-2 font-bold text-white">{t('contact.hours')}</h4>
          <p className="mt-1 text-sm text-white/60">{t('contact.hours_detail')}</p>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § FAQ ITEM
// ────────────────────────────────────────────────────────────────────────────

function FAQItem({
  faq,
  isExpanded,
  onToggle,
}: {
  faq: FAQItem
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl"
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-6 text-left transition-colors hover:bg-white/10"
      >
        <span className="flex-1 pr-4 font-medium text-white">{faq.question}</span>
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="h-5 w-5 shrink-0 text-white/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-6 pb-6 pt-4">
              <p className="text-sm leading-relaxed text-white/70">{faq.answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § CONTACT CARD
// ────────────────────────────────────────────────────────────────────────────

function ContactCard({
  icon,
  title,
  content,
  href,
}: {
  icon: string
  title: string
  content: string
  href: string
}) {
  return (
    <a
      href={href}
      className="group block rounded-2xl bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur-xl transition-all hover:from-white/15 hover:to-white/10"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-2xl">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-white/60">{title}</h4>
          <p className="mt-1 font-bold text-white group-hover:text-blue-400">{content}</p>
        </div>
      </div>
    </a>
  )
}
