'use client'

import { useState, useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { rooms, pills, type RoomId } from '@/lib/data/venue-rooms'

interface RoomViewerProps {
  initialRoom?: RoomId
  className?: string
}

export function RoomViewer({ initialRoom, className = '' }: RoomViewerProps) {
  const t = useTranslations()
  const [activePill, setActivePill] = useState(pills[0].id)
  const [dividerPosition, setDividerPosition] = useState(50) // 0-100
  const [isDragging, setIsDragging] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLButtonElement>(null)

  // Initialize from URL param
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room')
    if (roomParam === 'eternity') {
      setDividerPosition(0)
    } else if (roomParam === 'infinity') {
      setDividerPosition(100)
    }
  }, [])

  const currentPill = pills.find((p) => p.id === activePill) ?? pills[0]
  const hasSlider = currentPill.hasSlider

  // Get images for current pill
  const getImages = () => {
    if (currentPill.perRoom) {
      return {
        infinity: currentPill.perRoom.infinity,
        eternity: currentPill.perRoom.eternity,
      }
    }
    return null
  }

  const images = getImages()
  const sharedImage = currentPill.shared

  // Snap to room
  const snapToRoom = (roomId: RoomId) => {
    const newPosition = roomId === 'infinity' ? 100 : 0
    setDividerPosition(newPosition)

    // Update URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('room', roomId)
      window.history.replaceState({}, '', url)
    }
  }

  // Handle drag
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!hasSlider) return
    e.preventDefault()
    setIsDragging(true)
    thumbRef.current?.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !stageRef.current || !hasSlider) return

    const rect = stageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setDividerPosition(percentage)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!hasSlider) return
    setIsDragging(false)
    thumbRef.current?.releasePointerCapture(e.pointerId)
  }

  // Keyboard navigation for pills
  const handlePillKeyDown = (e: React.KeyboardEvent, pillId: string) => {
    const currentIndex = pills.findIndex((p) => p.id === pillId)

    if (e.key === 'ArrowDown' && currentIndex < pills.length - 1) {
      e.preventDefault()
      setActivePill(pills[currentIndex + 1].id)
    } else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault()
      setActivePill(pills[currentIndex - 1].id)
    }
  }

  // Keyboard navigation for slider
  const handleSliderKeyDown = (e: React.KeyboardEvent) => {
    if (!hasSlider) return

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setDividerPosition((p) => Math.max(0, p - 5))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setDividerPosition((p) => Math.min(100, p + 5))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setDividerPosition(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setDividerPosition(100)
    }
  }

  // Calculate label opacity
  const leftOpacity = dividerPosition < 15 ? 0 : 1
  const rightOpacity = dividerPosition > 85 ? 0 : 1

  return (
    <section
      className={className}
      style={{
        backgroundColor: '#000000',
        color: '#ffffff',
        minHeight: '100svh',
        paddingTop: 'calc(64px + 24px)',
        scrollMarginTop: '64px',
      }}
    >
      <div className="mx-auto max-w-[1440px] px-6 pb-12 lg:px-8">
        {/* Heading */}
        <h2
          className="mb-8 text-left text-[40px] font-semibold leading-tight lg:mb-12 lg:text-[56px]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('venue.rooms.title')}
        </h2>

        {/* Desktop layout */}
        <div className="hidden lg:grid lg:grid-cols-[400px_1fr] lg:gap-8">
          {/* Left column: pills */}
          <div role="tablist" aria-label="房間特色" className="flex flex-col gap-3">
            {pills.map((pill) => {
              const isActive = activePill === pill.id
              const smallLineKey = pill.perRoom
                ? dividerPosition > 50
                  ? pill.perRoom.infinity.smallLineKey
                  : pill.perRoom.eternity.smallLineKey
                : undefined

              return (
                <motion.button
                  key={pill.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${pill.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActivePill(pill.id)}
                  onKeyDown={(e) => handlePillKeyDown(e, pill.id)}
                  layout
                  initial={false}
                  animate={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                  whileHover={{
                    backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                  }}
                  transition={{
                    layout: { duration: 0.4, ease: [0.2, 0.7, 0.3, 1] },
                    backgroundColor: { duration: 0.2 },
                  }}
                  className="relative overflow-hidden rounded-[28px] text-left outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <motion.div
                    layout
                    className="px-6 py-4"
                  >
                    {/* Collapsed state: icon + label */}
                    {!isActive && (
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-[22px] w-[22px] items-center justify-center rounded-full"
                          style={{ border: '1.5px solid rgba(255,255,255,0.4)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M6 1v10M1 6h10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <span className="text-[16px] font-semibold">{t(pill.labelKey)}</span>
                      </div>
                    )}

                    {/* Expanded state: card content */}
                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <span className="text-[13px] font-medium uppercase tracking-wide text-[#86868b]">
                            {t(pill.labelKey)}
                          </span>
                          {pill.tag && (
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                              style={{
                                backgroundColor: 'rgba(255,255,255,0.1)',
                                color: '#86868b',
                              }}
                            >
                              {t(pill.tag)}
                            </span>
                          )}
                        </div>
                        <h3 className="mb-1 text-[20px] font-semibold leading-snug">
                          {t(pill.mainLineKey)}
                        </h3>
                        {smallLineKey && (
                          <p className="text-[14px] text-[#86868b]">{t(smallLineKey)}</p>
                        )}

                        {/* Compare bar (in card) */}
                        {pill.hasSlider && (
                          <div className="mt-6">
                            <p className="mb-3 text-[13px] text-[#86868b]">
                              {t('venue.rooms.slider_hint')}
                            </p>
                            <div
                              className="relative h-2 rounded-full"
                              style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                            >
                              <div
                                className="absolute left-1/2 top-1/2 flex h-[36px] w-[56px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                                style={{
                                  backgroundColor: '#16a34a',
                                  transform: `translate(-50%, -50%) translateX(${(dividerPosition - 50) * 2}%)`,
                                }}
                              >
                                <span className="text-[14px] font-medium">‹ ›</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                </motion.button>
              )
            })}
          </div>

          {/* Right column: stage */}
          <div
            id={`panel-${activePill}`}
            role="tabpanel"
            aria-labelledby={activePill}
            ref={stageRef}
            className="relative overflow-hidden rounded-[28px]"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              minHeight: 'calc(100svh - 64px - 24px - 80px - 96px)',
              maxHeight: 'calc(100svh - 64px - 24px - 96px)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activePill}-${hasSlider ? 'slider' : 'shared'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0"
              >
                {hasSlider && images ? (
                  <>
                    {/* Infinity (left side of divider) */}
                    <div
                      className="absolute inset-0"
                      style={{
                        clipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                      }}
                    >
                      <Image
                        src={images.infinity.image}
                        alt={images.infinity.alt}
                        fill
                        className="object-contain"
                        style={{ aspectRatio: '4/3' }}
                        sizes="60vw"
                        priority={activePill === pills[0].id}
                        onError={(e) => {
                          console.error(`Image failed to load: ${images.infinity.image}`)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>

                    {/* Eternity (right side of divider) */}
                    <div className="absolute inset-0">
                      <Image
                        src={images.eternity.image}
                        alt={images.eternity.alt}
                        fill
                        className="object-contain"
                        style={{ aspectRatio: '4/3' }}
                        sizes="60vw"
                        priority={activePill === pills[0].id}
                        onError={(e) => {
                          console.error(`Image failed to load: ${images.eternity.image}`)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>

                    {/* Divider line and handle */}
                    <div
                      className="absolute inset-y-0 w-[1.5px] bg-white"
                      style={{ left: `${dividerPosition}%` }}
                    >
                      <button
                        ref={thumbRef}
                        role="slider"
                        aria-label="拖動以比較兩間球室"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(dividerPosition)}
                        aria-valuetext={`${Math.round(dividerPosition)}%`}
                        tabIndex={0}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onKeyDown={handleSliderKeyDown}
                        className="absolute left-1/2 top-1/2 h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full bg-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        style={{ touchAction: 'none' }}
                      />
                    </div>

                    {/* Corner labels */}
                    <button
                      onClick={() => snapToRoom('infinity')}
                      className="absolute bottom-6 left-6 rounded-lg bg-black/40 px-3 py-2 text-left text-[12px] font-medium leading-tight backdrop-blur-sm transition-opacity duration-200 hover:bg-black/50 lg:text-[13px]"
                      style={{
                        opacity: leftOpacity,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {t('venue.rooms.infinity.name')}
                    </button>

                    <button
                      onClick={() => snapToRoom('eternity')}
                      className="absolute bottom-6 right-6 rounded-lg bg-black/40 px-3 py-2 text-right text-[12px] font-medium leading-tight backdrop-blur-sm transition-opacity duration-200 hover:bg-black/50 lg:text-[13px]"
                      style={{
                        opacity: rightOpacity,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {t('venue.rooms.eternity.name')}
                    </button>
                  </>
                ) : (
                  sharedImage && (
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className="relative" style={{ width: '70%', aspectRatio: '4/3' }}>
                        <Image
                          src={sharedImage.image}
                          alt={sharedImage.alt}
                          fill
                          className="object-contain"
                          sizes="60vw"
                          onError={(e) => {
                            console.error(`Image failed to load: ${sharedImage.image}`)
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Mobile layout */}
        <div className="lg:hidden">
          {/* Stage first */}
          <div
            id={`panel-${activePill}`}
            role="tabpanel"
            aria-labelledby={activePill}
            ref={stageRef}
            className="relative mb-6 overflow-hidden rounded-[28px]"
            style={{
              aspectRatio: '4/5',
              maxHeight: '70svh',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={`${activePill}-${hasSlider ? 'slider' : 'shared'}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-0"
              >
                {hasSlider && images ? (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        clipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                      }}
                    >
                      <Image
                        src={images.infinity.image}
                        alt={images.infinity.alt}
                        fill
                        className="object-contain"
                        style={{ aspectRatio: '4/3' }}
                        sizes="100vw"
                        onError={(e) => {
                          console.error(`Image failed to load: ${images.infinity.image}`)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    <div className="absolute inset-0">
                      <Image
                        src={images.eternity.image}
                        alt={images.eternity.alt}
                        fill
                        className="object-contain"
                        style={{ aspectRatio: '4/3' }}
                        sizes="100vw"
                        onError={(e) => {
                          console.error(`Image failed to load: ${images.eternity.image}`)
                          e.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    <div
                      className="absolute inset-y-0 w-[1.5px] bg-white"
                      style={{ left: `${dividerPosition}%` }}
                    >
                      <button
                        ref={thumbRef}
                        role="slider"
                        aria-label="拖動以比較兩間球室"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(dividerPosition)}
                        tabIndex={0}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onKeyDown={handleSliderKeyDown}
                        className="absolute left-1/2 top-1/2 h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full bg-white shadow-lg"
                        style={{ touchAction: 'none' }}
                      />
                    </div>
                    <button
                      onClick={() => snapToRoom('infinity')}
                      className="absolute bottom-4 left-4 rounded-lg bg-black/40 px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm transition-opacity"
                      style={{
                        opacity: leftOpacity,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {t('venue.rooms.infinity.name')}
                    </button>
                    <button
                      onClick={() => snapToRoom('eternity')}
                      className="absolute bottom-4 right-4 rounded-lg bg-black/40 px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-sm transition-opacity"
                      style={{
                        opacity: rightOpacity,
                        fontFamily: 'var(--font-display)',
                      }}
                    >
                      {t('venue.rooms.eternity.name')}
                    </button>
                  </>
                ) : (
                  sharedImage && (
                    <div className="absolute inset-0 flex items-center justify-center p-8">
                      <div className="relative" style={{ width: '70%', aspectRatio: '4/3' }}>
                        <Image
                          src={sharedImage.image}
                          alt={sharedImage.alt}
                          fill
                          className="object-contain"
                          sizes="100vw"
                          onError={(e) => {
                            console.error(`Image failed to load: ${sharedImage.image}`)
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Horizontally scrollable pills */}
          <div
            role="tablist"
            aria-label="房間特色"
            className="-mx-6 mb-6 flex gap-2 overflow-x-auto px-6 pb-2"
            style={{
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {pills.map((pill) => (
              <button
                key={pill.id}
                role="tab"
                aria-selected={activePill === pill.id}
                onClick={() => setActivePill(pill.id)}
                className="shrink-0 rounded-full px-5 py-3 text-[15px] font-semibold transition-all"
                style={{
                  backgroundColor:
                    activePill === pill.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
                  scrollSnapAlign: 'start',
                }}
              >
                {t(pill.labelKey)}
              </button>
            ))}
          </div>

          {/* Expanded card */}
          <div
            className="rounded-[28px] p-6"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="text-[13px] font-medium uppercase tracking-wide text-[#86868b]">
                {t(currentPill.labelKey)}
              </span>
              {currentPill.tag && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: '#86868b',
                  }}
                >
                  {t(currentPill.tag)}
                </span>
              )}
            </div>
            <h3 className="mb-1 text-[18px] font-semibold">{t(currentPill.mainLineKey)}</h3>
            {currentPill.perRoom && (
              <p className="text-[14px] text-[#86868b]">
                {t(
                  dividerPosition > 50
                    ? currentPill.perRoom.infinity.smallLineKey!
                    : currentPill.perRoom.eternity.smallLineKey!
                )}
              </p>
            )}

            {currentPill.hasSlider && (
              <div className="mt-6">
                <p className="mb-3 text-[13px] text-[#86868b]">
                  {t('venue.rooms.slider_hint')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
