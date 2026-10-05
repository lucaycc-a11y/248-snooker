'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { rooms, pills, type RoomId } from '@/lib/data/venue-rooms'
import { tokens } from '@/app/styles/tokens'

interface RoomViewerProps {
  initialRoom?: RoomId
  className?: string
}

// Image preloader with decode
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const timeout = setTimeout(() => {
      reject(new Error('Image decode timeout'))
    }, 2000)

    img.onload = () => {
      img
        .decode()
        .then(() => {
          clearTimeout(timeout)
          resolve()
        })
        .catch(() => {
          clearTimeout(timeout)
          resolve() // Don't block on decode failure
        })
    }
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Image load failed'))
    }
    img.src = src
  })
}

export function RoomViewer({ initialRoom, className = '' }: RoomViewerProps) {
  const t = useTranslations()
  const [activePill, setActivePill] = useState(pills[0].id)
  const [dividerPosition, setDividerPosition] = useState(50) // 0-100
  const [isDragging, setIsDragging] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Dual-layer state for crossfade
  const [frontLayer, setFrontLayer] = useState<{
    pillId: string
    images: { infinity?: string; eternity?: string; shared?: string }
  }>({
    pillId: pills[0].id,
    images: {},
  })
  const [backLayer, setBackLayer] = useState<typeof frontLayer | null>(null)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLButtonElement>(null)
  const preloadedRef = useRef<Set<string>>(new Set())

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
  const getImages = (pillId: string) => {
    const pill = pills.find((p) => p.id === pillId) ?? pills[0]
    if (pill.perRoom) {
      return {
        infinity: pill.perRoom.infinity.image,
        eternity: pill.perRoom.eternity.image,
      }
    }
    return { shared: pill.shared?.image }
  }

  // Preload image on hover/focus
  const handlePreload = useCallback(async (pillId: string) => {
    const images = getImages(pillId)
    const urls = Object.values(images).filter((url): url is string => !!url)

    for (const url of urls) {
      if (!preloadedRef.current.has(url)) {
        try {
          await preloadImage(url)
          preloadedRef.current.add(url)
        } catch (err) {
          console.warn(`Preload failed for ${url}:`, err)
        }
      }
    }
  }, [])

  // Preload all images after idle
  useEffect(() => {
    const timer = setTimeout(() => {
      pills.forEach((pill) => {
        handlePreload(pill.id)
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [handlePreload])

  // Change pill with crossfade
  const changePill = useCallback(async (newPillId: string) => {
    if (isTransitioning) return

    const newImages = getImages(newPillId)
    const urls = Object.values(newImages).filter((url): url is string => !!url)

    setIsTransitioning(true)
    setLoadError(null)

    // Preload new images in back layer
    try {
      await Promise.all(urls.map((url) => preloadImage(url)))
    } catch (err) {
      console.error('Image load failed:', err)
      setLoadError('無法載入相片')
      setIsTransitioning(false)
      return
    }

    // Set back layer with new images
    setBackLayer({ pillId: newPillId, images: newImages })

    // Wait for next frame, then crossfade
    requestAnimationFrame(() => {
      setTimeout(() => {
        setFrontLayer({ pillId: newPillId, images: newImages })
        setBackLayer(null)
        setIsTransitioning(false)
      }, 300)
    })
  }, [isTransitioning])

  // Handle pill change
  useEffect(() => {
    if (activePill !== frontLayer.pillId) {
      changePill(activePill)
    }
  }, [activePill, frontLayer.pillId, changePill])

  // Snap to room
  const snapToRoom = (roomId: RoomId) => {
    const newPosition = roomId === 'infinity' ? 100 : 0
    setDividerPosition(newPosition)

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

  // Touch move handler
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!stageRef.current || !hasSlider) return

    const touch = e.touches[0]
    const rect = stageRef.current.getBoundingClientRect()
    const x = touch.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100))
    setDividerPosition(percentage)
  }

  // Keyboard navigation for pills
  const handlePillKeyDown = (e: React.KeyboardEvent, pillId: string) => {
    const currentIndex = pills.findIndex((p) => p.id === pillId)
    let nextIndex = currentIndex

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      nextIndex = (currentIndex + 1) % pills.length
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIndex = currentIndex - 1 < 0 ? pills.length - 1 : currentIndex - 1
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIndex = pills.length - 1
    }

    if (nextIndex !== currentIndex) {
      setActivePill(pills[nextIndex].id)
      // Focus the new pill
      setTimeout(() => {
        const nextPill = document.querySelector(
          `[role="tab"][aria-controls="panel-${pills[nextIndex].id}"]`
        ) as HTMLElement
        nextPill?.focus()
      }, 0)
    }
  }

  // Keyboard navigation for slider
  const handleSliderKeyDown = (e: React.KeyboardEvent) => {
    if (!hasSlider) return

    let newPosition = dividerPosition

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      newPosition = Math.max(0, dividerPosition - 5)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      newPosition = Math.min(100, dividerPosition + 5)
    } else if (e.key === 'Home') {
      e.preventDefault()
      newPosition = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      newPosition = 100
    }

    if (newPosition !== dividerPosition) {
      setDividerPosition(newPosition)
    }
  }

  // Opacity for corner labels
  const leftOpacity = Math.max(0, Math.min(1, dividerPosition / 15))
  const rightOpacity = Math.max(0, Math.min(1, (100 - dividerPosition) / 15))

  // Reduced motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <section
      className={className}
      style={{
        backgroundColor: tokens.colors.bg,
        color: '#ffffff',
        minHeight: '100svh',
        paddingTop: `calc(${tokens.layout.navbarHeight} + 16px)`,
        scrollMarginTop: tokens.layout.navbarHeight,
      }}
    >
      <div className="mx-auto max-w-[1440px] px-6 pb-12 lg:px-8">
        {/* Heading */}
        <h2
          className="mb-6 text-left leading-tight lg:mb-8"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(30px, 4vw, 44px)',
            fontWeight: 600,
          }}
        >
          {t('venue.rooms.title')}
        </h2>

        {/* Desktop/Tablet layout (768px+) */}
        <div className="hidden md:grid md:gap-6 lg:gap-8" style={{ gridTemplateColumns: 'minmax(280px, 36%) 1fr' }}>
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
                  onPointerEnter={() => handlePreload(pill.id)}
                  onFocus={() => handlePreload(pill.id)}
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
                    layout: { duration: prefersReducedMotion ? 0 : 0.4, ease: [0.2, 0.7, 0.3, 1] },
                    backgroundColor: { duration: 0.2 },
                  }}
                  className="relative overflow-hidden rounded-[28px] text-left outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  style={{
                    border: '1px solid rgba(255,255,255,0.08)',
                    minHeight: '44px',
                  }}
                >
                  <motion.div layout className="px-6 py-4">
                    {/* Collapsed state */}
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

                    {/* Expanded state */}
                    {isActive && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: prefersReducedMotion ? 0 : 0.3, delay: 0.1 }}
                        className="space-y-4"
                      >
                        {/* Label + tag */}
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-[20px] font-bold leading-tight">{t(pill.labelKey)}</h3>
                          {pill.tag && (
                            <span
                              className="rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-wide"
                              style={{
                                backgroundColor: 'rgba(22,163,74,0.1)',
                                color: '#16a34a',
                                border: '1px solid rgba(22,163,74,0.3)',
                              }}
                            >
                              {t(pill.tag)}
                            </span>
                          )}
                        </div>

                        {/* Main line */}
                        <p className="text-[15px] leading-relaxed opacity-90">{t(pill.mainLineKey)}</p>

                        {/* Small lines (per-room pills only) */}
                        {smallLineKey && (
                          <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {t(smallLineKey)}
                          </p>
                        )}

                        {/* Track for hasSlider pills */}
                        {hasSlider && (
                          <div className="relative mt-6 h-[6px] w-full overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              className="absolute left-0 top-0 h-full rounded-full"
                              style={{
                                width: `${dividerPosition}%`,
                                backgroundColor: tokens.colors.green[600],
                              }}
                              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            />
                            <button
                              ref={thumbRef}
                              role="slider"
                              aria-label="拖動以比較兩間球室"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.round(dividerPosition)}
                              aria-valuetext={`${Math.round(dividerPosition)}%`}
                              tabIndex={-1}
                              onPointerDown={handlePointerDown}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              className="absolute top-1/2 h-[36px] w-[56px] -translate-y-1/2 cursor-ew-resize rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                              style={{
                                left: `${dividerPosition}%`,
                                transform: `translate(-50%, -50%)`,
                                backgroundColor: tokens.colors.green[600],
                                touchAction: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#ffffff',
                              }}
                            >
                              ‹ ›
                            </button>
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
              aspectRatio: '4 / 3',
              minWidth: '340px',
              backgroundColor: currentPill.id === 'technology' ? '#0a0a0a' : '#000000',
              // Gradient for technology pill
              ...(currentPill.id === 'technology' && {
                background: `
                  radial-gradient(ellipse 50% 40% at 50% 50%, rgba(88, 28, 135, 0.32), transparent 70%),
                  radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37, 99, 235, 0.18), transparent 80%),
                  linear-gradient(135deg, #1a0b2e 0%, #0f172a 50%, #0a0a0a 100%)
                `,
              }),
            }}
          >
            {/* Load error */}
            {loadError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="rounded-lg bg-black/60 px-4 py-3 text-center backdrop-blur-sm">
                  <p className="text-sm text-white/80">{loadError}</p>
                  <button
                    onClick={() => {
                      setLoadError(null)
                      changePill(activePill)
                    }}
                    className="mt-2 text-xs underline opacity-70 hover:opacity-100"
                  >
                    重試
                  </button>
                </div>
              </div>
            )}

            {/* Stage layers */}
            {!loadError && (
              <>
                {/* Front layer (visible) */}
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: backLayer ? 0 : 1,
                    transition: backLayer ? 'opacity 300ms ease-out' : 'none',
                  }}
                >
                  {frontLayer.images.infinity && frontLayer.images.eternity ? (
                    <>
                      {/* Infinity layer */}
                      <div
                        className="absolute inset-0"
                        style={{
                          clipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                        }}
                      >
                        <Image
                          src={frontLayer.images.infinity}
                          alt={t('venue.rooms.infinity.name')}
                          fill
                          className="object-cover"
                          style={{ objectPosition: '50% 50%' }}
                          sizes="(min-width: 768px) 60vw, 100vw"
                          priority
                        />
                      </div>

                      {/* Eternity layer */}
                      <div className="absolute inset-0">
                        <Image
                          src={frontLayer.images.eternity}
                          alt={t('venue.rooms.eternity.name')}
                          fill
                          className="object-cover"
                          style={{ objectPosition: '50% 50%' }}
                          sizes="(min-width: 768px) 60vw, 100vw"
                          priority
                        />
                      </div>

                      {/* Divider */}
                      <div
                        className="absolute inset-y-0 w-[2px] bg-white"
                        style={{ left: `${dividerPosition}%` }}
                        onTouchMove={handleTouchMove}
                      >
                        <button
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
                          className="absolute left-1/2 top-1/2 h-[48px] w-[48px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full bg-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          style={{
                            touchAction: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '18px',
                            fontWeight: 600,
                            color: tokens.colors.text,
                          }}
                        >
                          ‹ ›
                        </button>
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
                  ) : frontLayer.images.shared ? (
                    <Image
                      src={frontLayer.images.shared}
                      alt={t(currentPill.labelKey)}
                      fill
                      className="object-cover"
                      style={{
                        objectPosition: currentPill.id === 'technology' ? '50% 50%' : '50% 50%',
                        objectFit: currentPill.id === 'technology' ? 'contain' : 'cover',
                        maxWidth: currentPill.id === 'technology' ? '52%' : 'none',
                        maxHeight: currentPill.id === 'technology' ? '85%' : 'none',
                        margin: currentPill.id === 'technology' ? 'auto' : '0',
                      }}
                      sizes="(min-width: 768px) 60vw, 100vw"
                    />
                  ) : null}
                </div>

                {/* Back layer (preloading) */}
                {backLayer && (
                  <div
                    className="absolute inset-0"
                    style={{
                      opacity: 1,
                      transition: 'opacity 300ms ease-in',
                    }}
                  >
                    {backLayer.images.infinity && backLayer.images.eternity ? (
                      <>
                        <div
                          className="absolute inset-0"
                          style={{
                            clipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                          }}
                        >
                          <Image
                            src={backLayer.images.infinity}
                            alt={t('venue.rooms.infinity.name')}
                            fill
                            className="object-cover"
                            style={{ objectPosition: '50% 50%' }}
                            sizes="(min-width: 768px) 60vw, 100vw"
                          />
                        </div>
                        <div className="absolute inset-0">
                          <Image
                            src={backLayer.images.eternity}
                            alt={t('venue.rooms.eternity.name')}
                            fill
                            className="object-cover"
                            style={{ objectPosition: '50% 50%' }}
                            sizes="(min-width: 768px) 60vw, 100vw"
                          />
                        </div>
                      </>
                    ) : backLayer.images.shared ? (
                      <Image
                        src={backLayer.images.shared}
                        alt={t(currentPill.labelKey)}
                        fill
                        className="object-cover"
                        style={{
                          objectPosition: '50% 50%',
                          objectFit: backLayer.pillId === 'technology' ? 'contain' : 'cover',
                          maxWidth: backLayer.pillId === 'technology' ? '52%' : 'none',
                          maxHeight: backLayer.pillId === 'technology' ? '85%' : 'none',
                          margin: backLayer.pillId === 'technology' ? 'auto' : '0',
                        }}
                        sizes="(min-width: 768px) 60vw, 100vw"
                      />
                    ) : null}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Mobile layout (<768px) */}
        <div className="md:hidden">
          {/* Stage first */}
          <div
            id={`panel-${activePill}`}
            role="tabpanel"
            aria-labelledby={activePill}
            className="relative mb-6 overflow-hidden rounded-[28px]"
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              aspectRatio: '4 / 3',
              width: '100%',
              backgroundColor: currentPill.id === 'technology' ? '#0a0a0a' : '#000000',
              ...(currentPill.id === 'technology' && {
                background: `
                  radial-gradient(ellipse 50% 40% at 50% 50%, rgba(88, 28, 135, 0.32), transparent 70%),
                  radial-gradient(ellipse 60% 50% at 50% 50%, rgba(37, 99, 235, 0.18), transparent 80%),
                  linear-gradient(135deg, #1a0b2e 0%, #0f172a 50%, #0a0a0a 100%)
                `,
              }),
            }}
          >
            {/* Mobile stage content (same as desktop) */}
            {!loadError && (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    opacity: backLayer ? 0 : 1,
                    transition: backLayer ? 'opacity 300ms ease-out' : 'none',
                  }}
                >
                  {frontLayer.images.infinity && frontLayer.images.eternity ? (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{
                          clipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                        }}
                      >
                        <Image
                          src={frontLayer.images.infinity}
                          alt={t('venue.rooms.infinity.name')}
                          fill
                          className="object-cover"
                          sizes="100vw"
                          priority
                        />
                      </div>
                      <div className="absolute inset-0">
                        <Image
                          src={frontLayer.images.eternity}
                          alt={t('venue.rooms.eternity.name')}
                          fill
                          className="object-cover"
                          sizes="100vw"
                          priority
                        />
                      </div>

                      {/* Mobile divider with thumb */}
                      {hasSlider && (
                        <div
                          className="absolute inset-y-0 w-[2px] bg-white"
                          style={{ left: `${dividerPosition}%` }}
                          onTouchMove={handleTouchMove}
                        >
                          <div
                            className="absolute left-1/2 top-1/2 h-[44px] w-[44px] -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full bg-white shadow-lg"
                            style={{
                              touchAction: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              fontWeight: 600,
                              color: tokens.colors.text,
                            }}
                          >
                            ‹ ›
                          </div>
                        </div>
                      )}
                    </>
                  ) : frontLayer.images.shared ? (
                    <Image
                      src={frontLayer.images.shared}
                      alt={t(currentPill.labelKey)}
                      fill
                      className="object-cover"
                      style={{
                        objectFit: currentPill.id === 'technology' ? 'contain' : 'cover',
                        maxWidth: currentPill.id === 'technology' ? '52%' : 'none',
                        maxHeight: currentPill.id === 'technology' ? '85%' : 'none',
                        margin: currentPill.id === 'technology' ? 'auto' : '0',
                      }}
                      sizes="100vw"
                    />
                  ) : null}
                </div>
              </>
            )}
          </div>

          {/* Pills below (mobile) */}
          <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollSnapType: 'x mandatory' }}>
            {pills.map((pill) => (
              <button
                key={pill.id}
                role="tab"
                aria-selected={activePill === pill.id}
                onClick={() => setActivePill(pill.id)}
                className="flex-shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor:
                    activePill === pill.id ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  scrollSnapAlign: 'start',
                  minWidth: 'fit-content',
                }}
              >
                {t(pill.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
