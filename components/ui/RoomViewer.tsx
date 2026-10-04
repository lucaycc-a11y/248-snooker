'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { tokens } from '@/app/styles/tokens'
import { rooms, pills, getPillImage, getPillSmallLineKey, type RoomId } from '@/lib/data/venue-rooms'

interface RoomViewerProps {
  theme?: 'dark' | 'light'
  initialRoom?: RoomId
  className?: string
}

export function RoomViewer({ theme = 'dark', initialRoom = 'infinity', className = '' }: RoomViewerProps) {
  const t = useTranslations()
  const [activePill, setActivePill] = useState(pills[0].id)
  const [selectedRoom, setSelectedRoom] = useState<RoomId>(initialRoom)
  const [imageKey, setImageKey] = useState(0)

  const isDark = theme === 'dark'

  // Get current pill and image
  const currentPill = pills.find((p) => p.id === activePill) ?? pills[0]
  const currentImage = getPillImage(activePill, selectedRoom)
  const currentSmallLineKey = getPillSmallLineKey(activePill, selectedRoom)

  // Change image with timed crossfade
  useEffect(() => {
    setImageKey((k) => k + 1)
  }, [activePill, selectedRoom])

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, pillId: string) => {
    const currentIndex = pills.findIndex((p) => p.id === pillId)

    if (e.key === 'ArrowRight' && currentIndex < pills.length - 1) {
      e.preventDefault()
      setActivePill(pills[currentIndex + 1].id)
    } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
      e.preventDefault()
      setActivePill(pills[currentIndex - 1].id)
    }
  }

  return (
    <section
      className={className}
      style={{
        backgroundColor: isDark ? tokens.colors.bg : '#ffffff',
        color: isDark ? tokens.colors.text : '#1d1d1f',
      }}
    >
      <div className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8 lg:py-20">
        {/* Section title */}
        <h2
          className="mb-8 text-center font-display text-3xl lg:mb-12 lg:text-4xl"
          style={{ fontFamily: tokens.font.display }}
        >
          {t('venue.rooms.title')}
        </h2>

        {/* Desktop layout: left column (card) + right column (stage) */}
        <div className="hidden lg:grid lg:grid-cols-[40%_60%] lg:gap-8 lg:items-center">
          {/* Left: expanded card + pills */}
          <div>
            {/* Expanded card */}
            <div
              className="mb-6 rounded-3xl p-8"
              style={{
                backgroundColor: isDark ? tokens.colors.surface : '#ffffff',
                border: `1px solid ${isDark ? tokens.colors.border : 'rgba(0,0,0,0.08)'}`,
              }}
            >
              <div className="mb-6">
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: isDark ? tokens.colors.text : '#1d1d1f' }}
                  >
                    {t(currentPill.labelKey)}
                  </span>
                  {currentPill.tag && (
                    <span
                      className="rounded-full px-3 py-1 text-xs"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                        color: isDark ? tokens.colors.textMuted : '#6e6e73',
                      }}
                    >
                      {currentPill.tag}
                    </span>
                  )}
                </div>
                <p
                  className="mb-1 text-[15px]"
                  style={{ color: isDark ? tokens.colors.text : '#1d1d1f' }}
                >
                  {t(currentPill.mainLineKey)}
                </p>
                {currentSmallLineKey && (
                  <p
                    className="text-[13px]"
                    style={{ color: isDark ? tokens.colors.textMuted : '#6e6e73' }}
                  >
                    {t(currentSmallLineKey)}
                  </p>
                )}
              </div>

              {/* Room slider (only for pills 1 and 2) */}
              {currentPill.hasSlider && (
                <div
                  role="radiogroup"
                  aria-label={t('venue.rooms.slider.label')}
                  className="flex gap-2 rounded-full p-1"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  }}
                >
                  {rooms.map((room) => (
                    <button
                      key={room.id}
                      role="radio"
                      aria-checked={selectedRoom === room.id}
                      onClick={() => setSelectedRoom(room.id)}
                      className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all duration-200"
                      style={{
                        backgroundColor: selectedRoom === room.id
                          ? isDark ? tokens.colors.text : '#1d1d1f'
                          : 'transparent',
                        color: selectedRoom === room.id
                          ? isDark ? tokens.colors.bg : '#ffffff'
                          : isDark ? tokens.colors.textMuted : '#6e6e73',
                      }}
                    >
                      {t(room.nameKey)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pills */}
            <div role="tablist" aria-label={t('venue.rooms.pills.label')} className="flex flex-col gap-2">
              {pills.map((pill) => (
                <button
                  key={pill.id}
                  role="tab"
                  aria-selected={activePill === pill.id}
                  aria-controls={`panel-${pill.id}`}
                  tabIndex={activePill === pill.id ? 0 : -1}
                  onClick={() => setActivePill(pill.id)}
                  onKeyDown={(e) => handleKeyDown(e, pill.id)}
                  className="rounded-full px-5 py-3 text-left text-[15px] font-semibold transition-all duration-200"
                  style={{
                    backgroundColor: activePill === pill.id
                      ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
                      : 'transparent',
                    color: activePill === pill.id
                      ? isDark ? tokens.colors.text : '#1d1d1f'
                      : isDark ? tokens.colors.textMuted : '#6e6e73',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = `0 0 0 2px ${isDark ? tokens.colors.brand : '#007aff'}`
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {t(pill.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Right: stage image */}
          <div
            id={`panel-${activePill}`}
            role="tabpanel"
            aria-labelledby={activePill}
            className="relative aspect-[3/2] w-full overflow-hidden rounded-3xl"
            style={{ backgroundColor: isDark ? tokens.colors.surface : '#f5f5f7' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={imageKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {currentImage.image && (
                  <Image
                    src={currentImage.image}
                    alt={currentImage.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    priority={activePill === pills[0].id && selectedRoom === 'infinity'}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile layout: stage on top, pills below with horizontal scroll */}
        <div className="lg:hidden">
          {/* Stage image */}
          <div
            id={`panel-${activePill}`}
            role="tabpanel"
            aria-labelledby={activePill}
            className="relative mb-6 aspect-[3/2] w-full overflow-hidden rounded-3xl"
            style={{ backgroundColor: isDark ? tokens.colors.surface : '#f5f5f7' }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={imageKey}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {currentImage.image && (
                  <Image
                    src={currentImage.image}
                    alt={currentImage.alt}
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={activePill === pills[0].id && selectedRoom === 'infinity'}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Pills - horizontal scroll with peek */}
          <div
            role="tablist"
            aria-label={t('venue.rooms.pills.label')}
            className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {pills.map((pill) => (
              <button
                key={pill.id}
                role="tab"
                aria-selected={activePill === pill.id}
                aria-controls={`panel-${pill.id}`}
                tabIndex={activePill === pill.id ? 0 : -1}
                onClick={() => setActivePill(pill.id)}
                onKeyDown={(e) => handleKeyDown(e, pill.id)}
                className="shrink-0 rounded-full px-5 py-2.5 text-[15px] font-semibold transition-all duration-200"
                style={{
                  backgroundColor: activePill === pill.id
                    ? isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'
                    : 'transparent',
                  color: activePill === pill.id
                    ? isDark ? tokens.colors.text : '#1d1d1f'
                    : isDark ? tokens.colors.textMuted : '#6e6e73',
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${isDark ? tokens.colors.brand : '#007aff'}`
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {t(pill.labelKey)}
              </button>
            ))}
          </div>

          {/* Expanded card content below pills */}
          <div
            className="rounded-3xl p-6"
            style={{
              backgroundColor: isDark ? tokens.colors.surface : '#ffffff',
              border: `1px solid ${isDark ? tokens.colors.border : 'rgba(0,0,0,0.08)'}`,
            }}
          >
            <div className="mb-4 flex items-center gap-2">
              <span
                className="text-[15px] font-semibold"
                style={{ color: isDark ? tokens.colors.text : '#1d1d1f' }}
              >
                {t(currentPill.labelKey)}
              </span>
              {currentPill.tag && (
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    color: isDark ? tokens.colors.textMuted : '#6e6e73',
                  }}
                >
                  {currentPill.tag}
                </span>
              )}
            </div>
            <p
              className="mb-1 text-[15px]"
              style={{ color: isDark ? tokens.colors.text : '#1d1d1f' }}
            >
              {t(currentPill.mainLineKey)}
            </p>
            {currentSmallLineKey && (
              <p
                className="mb-4 text-[13px]"
                style={{ color: isDark ? tokens.colors.textMuted : '#6e6e73' }}
              >
                {t(currentSmallLineKey)}
              </p>
            )}

            {/* Room segmented control (only for pills 1 and 2) */}
            {currentPill.hasSlider && (
              <div
                role="radiogroup"
                aria-label={t('venue.rooms.slider.label')}
                className="flex gap-2 rounded-full p-1"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }}
              >
                {rooms.map((room) => (
                  <button
                    key={room.id}
                    role="radio"
                    aria-checked={selectedRoom === room.id}
                    onClick={() => setSelectedRoom(room.id)}
                    className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-medium transition-all duration-200"
                    style={{
                      backgroundColor: selectedRoom === room.id
                        ? isDark ? tokens.colors.text : '#1d1d1f'
                        : 'transparent',
                      color: selectedRoom === room.id
                        ? isDark ? tokens.colors.bg : '#ffffff'
                        : isDark ? tokens.colors.textMuted : '#6e6e73',
                    }}
                  >
                    {t(room.nameKey)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
