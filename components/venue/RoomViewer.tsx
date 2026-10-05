'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { tokens } from '@/app/styles/tokens'
import { pills, roomLabels, type PillId, type EquipmentViewKey, type EternityViewKey } from '@/lib/data/venue-room-viewer'

const EASE = 'cubic-bezier(0.2,0.7,0.3,1)'
const POP = 'cubic-bezier(0.34,1.56,0.64,1)'

// SVG icons for technology points
const ICONS = {
  spark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3.5l1.9 5.4 5.4 1.9-5.4 1.9-1.9 5.4-1.9-5.4-5.4-1.9 5.4-1.9z" />
    </svg>
  ),
  timer: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M9.5 3.5h5" />
    </svg>
  ),
  bars: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M5.5 19.5v-6M12 19.5v-14M18.5 19.5V9.5" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 8.6l5 3.4-5 3.4z" />
    </svg>
  ),
}

// Image preloader with decode
const preloadImage = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const timeout = setTimeout(() => reject(new Error('Decode timeout')), 2000)

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

export function RoomViewer() {
  const t = useTranslations('venue.rooms')

  const [activePill, setActivePill] = useState<PillId>('renovation')
  const [dividerPosition, setDividerPosition] = useState(50) // 0-100
  const [isDragging, setIsDragging] = useState(false)
  const [equipmentView, setEquipmentView] = useState<EquipmentViewKey>('table')
  const [eternityView, setEternityView] = useState<EternityViewKey>('sofa')
  const [touched, setTouched] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const pillsRef = useRef<HTMLDivElement>(null)
  const preloadedRef = useRef<Set<string>>(new Set())
  const rafRef = useRef<number>(0)

  const currentPill = pills.find((p) => p.id === activePill) ?? pills[0]
  const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width:1024px)').matches
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Preload image with cache
  const handlePreload = useCallback(async (src: string) => {
    if (!preloadedRef.current.has(src)) {
      try {
        await preloadImage(src)
        preloadedRef.current.add(src)
      } catch (err) {
        console.warn(`Preload failed for ${src}:`, err)
      }
    }
  }, [])

  // Preload all stage images after idle
  useEffect(() => {
    const timer = setTimeout(() => {
      pills.forEach((pill) => {
        if (pill.perRoom) {
          handlePreload(pill.perRoom.infinity.src)
          handlePreload(pill.perRoom.eternity.src)
        }
        if (pill.eternityViews) {
          pill.eternityViews.forEach((v) => handlePreload(v.image.src))
        }
        if (pill.views) {
          pill.views.forEach((v) => handlePreload(v.image.src))
        }
        if (pill.pilotImage) {
          handlePreload(pill.pilotImage.src)
        }
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [handlePreload])

  // Tween divider position
  const tweenDivider = useCallback(
    (to: number, ms = 360) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (prefersReducedMotion) {
        setDividerPosition(to)
        return Promise.resolve()
      }

      const from = dividerPosition
      const t0 = performance.now()

      return new Promise<void>((resolve) => {
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / ms)
          const e = 1 - Math.pow(1 - k, 3) // ease-out cubic
          setDividerPosition(from + (to - from) * e)

          if (k < 1) {
            rafRef.current = requestAnimationFrame(step)
          } else {
            resolve()
          }
        }
        rafRef.current = requestAnimationFrame(step)
      })
    },
    [dividerPosition, prefersReducedMotion]
  )

  // Initial drift animation on first scroll into view
  useEffect(() => {
    if (prefersReducedMotion || !stageRef.current) return

    const observer = new IntersectionObserver(
      async (entries, obs) => {
        if (!entries[0].isIntersecting) return
        obs.disconnect()

        setTimeout(async () => {
          if (touched || currentPill.mode !== 'compare') return
          await tweenDivider(36, 520)
          if (touched) return
          await tweenDivider(64, 760)
          if (touched) return
          await tweenDivider(50, 520)
        }, 400)
      },
      { threshold: 0.6 }
    )

    observer.observe(stageRef.current)
    return () => observer.disconnect()
  }, [currentPill.mode, touched, tweenDivider, prefersReducedMotion])

  // Handle divider drag
  const handlePointerDown = (e: React.PointerEvent) => {
    if (currentPill.mode !== 'compare') return
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    // Touch: only drag near divider (within 44px); mouse/pen: anywhere
    if (e.pointerType === 'touch' && Math.abs(x - (rect.width * dividerPosition) / 100) > 44) {
      return
    }

    e.preventDefault()
    setIsDragging(true)
    setTouched(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    stageRef.current?.setPointerCapture(e.pointerId)
    setDividerPosition((x / rect.width) * 100)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    setDividerPosition(Math.max(0, Math.min(100, (x / rect.width) * 100)))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false)
    stageRef.current?.releasePointerCapture(e.pointerId)
  }

  // Snap to room
  const snapToRoom = (room: 'infinity' | 'eternity') => {
    setTouched(true)
    tweenDivider(room === 'infinity' ? 100 : 0)
  }

  // Handle pill keyboard navigation
  const handlePillKeyDown = (e: React.KeyboardEvent, pillId: PillId) => {
    const ids = pills.map((p) => p.id)
    let index = ids.indexOf(pillId)

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      index = (index + 1) % ids.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      index = index - 1 < 0 ? ids.length - 1 : index - 1
    } else if (e.key === 'Home') {
      e.preventDefault()
      index = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      index = ids.length - 1
    } else {
      return
    }

    setActivePill(ids[index])
    setTimeout(() => {
      const btn = document.querySelector(
        `[role="tab"][aria-controls="panel-${ids[index]}"]`
      ) as HTMLElement
      btn?.focus()
    }, 0)
  }

  // Handle slider keyboard navigation
  const handleSliderKeyDown = (e: React.KeyboardEvent) => {
    if (currentPill.mode !== 'compare') return

    let newPos = dividerPosition

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      newPos = Math.max(0, dividerPosition - 10)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      newPos = Math.min(100, dividerPosition + 10)
    } else if (e.key === 'Home') {
      e.preventDefault()
      newPos = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      newPos = 100
    } else {
      return
    }

    setTouched(true)
    setDividerPosition(newPos)
  }

  // Handle Eternity view switch
  const handleEternitySwitch = (key: EternityViewKey) => {
    setEternityView(key)
    setTouched(true)
    // If Eternity is mostly hidden, ease to 40% so it's visible
    if (dividerPosition > 60) {
      tweenDivider(40)
    }
  }

  // Corner label opacity
  const leftOpacity = Math.max(0, Math.min(1, dividerPosition / 15))
  const rightOpacity = Math.max(0, Math.min(1, (100 - dividerPosition) / 15))

  // Describe position for screen readers
  const describePosition = (p: number) => {
    if (p >= 96) return '只顯示 Space Infinity'
    if (p <= 4) return '只顯示 Space Eternity'
    return `左邊 Space Infinity，右邊 Space Eternity，分界線在 ${Math.round(p)}%`
  }

  return (
    <section
      style={{
        backgroundColor: tokens.colors.bg,
        color: tokens.colors.text,
        minHeight: `calc(100svh - ${tokens.layout.navbarHeight})`,
        paddingTop: `calc(${tokens.layout.navbarHeight} + 12px)`,
        paddingBottom: '56px',
        scrollMarginTop: tokens.layout.navbarHeight,
      }}
    >
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '0 clamp(16px, 4vw, 48px)',
        }}
      >
        {/* Heading */}
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(30px, 5vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            margin: '0 0 clamp(18px, 2.6vw, 32px)',
          }}
        >
          {t('title')}
        </h2>

        {/* Layout: desktop 2-column, mobile stack */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isDesktop ? 'minmax(300px, 380px) 1fr' : '1fr',
            gridTemplateAreas: isDesktop ? '"side stage"' : '"stage" "side"',
            gap: '18px',
          }}
        >
          {/* Side: Pills (desktop: left column, mobile: below stage) */}
          <div
            ref={pillsRef}
            role="tablist"
            aria-label="房間特色"
            style={{
              gridArea: 'side',
              display: 'flex',
              flexDirection: isDesktop ? 'column' : 'row',
              gap: isDesktop ? '12px' : '10px',
              overflowX: isDesktop ? 'visible' : 'auto',
              scrollSnapType: isDesktop ? 'none' : 'x proximity',
              scrollbarWidth: 'none',
              marginInline: isDesktop ? 0 : 'calc(-1 * clamp(16px, 4vw, 48px))',
              paddingInline: isDesktop ? 0 : 'clamp(16px, 4vw, 48px)',
            }}
          >
            {pills.map((pill) => {
              const isActive = activePill === pill.id

              return (
                <button
                  key={pill.id}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${pill.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActivePill(pill.id)}
                  onKeyDown={(e) => handlePillKeyDown(e, pill.id)}
                  style={{
                    minHeight: '44px',
                    padding: isDesktop && isActive ? '24px' : '0 18px',
                    borderRadius: isDesktop ? '28px' : '999px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                    color: tokens.colors.text,
                    fontFamily: 'var(--font-cjk)',
                    fontSize: '15px',
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: `background ${tokens.duration.base} ${EASE}`,
                    outline: 'none',
                    flexShrink: 0,
                    scrollSnapAlign: 'start',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.outline = `2px solid ${tokens.colors.green[600]}`
                    e.currentTarget.style.outlineOffset = '2px'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    {/* Icon (desktop only when inactive) */}
                    {isDesktop && !isActive && (
                      <div
                        style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          border: '1.5px solid rgba(255,255,255,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
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
                    )}

                    {/* Label */}
                    <span>{t(pill.labelKey)}</span>

                    {/* Tag */}
                    {pill.tag && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '4px 9px',
                          borderRadius: '999px',
                          border: '1px solid rgba(255,255,255,0.24)',
                          color: 'rgba(255,255,255,0.72)',
                        }}
                      >
                        {t(pill.tag)}
                      </span>
                    )}
                  </div>

                  {/* Expanded panel content (desktop only when active) */}
                  {isDesktop && isActive && (
                    <div style={{ marginTop: '16px' }}>
                      <p
                        style={{
                          fontSize: '15px',
                          lineHeight: 1.4,
                          color: 'rgba(255,255,255,0.9)',
                          margin: '0 0 16px',
                        }}
                      >
                        {t(pill.mainLineKey)}
                      </p>

                      {/* Eternity switch (comfort pill) */}
                      {pill.eternityViews && (
                        <div
                          role="group"
                          aria-label="Space Eternity 檢視"
                          style={{
                            display: 'flex',
                            gap: '4px',
                            padding: '4px',
                            borderRadius: '999px',
                            background: 'rgba(255,255,255,0.06)',
                            marginBottom: '16px',
                          }}
                        >
                          {pill.eternityViews.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              aria-pressed={eternityView === v.key}
                              onClick={() => handleEternitySwitch(v.key)}
                              style={{
                                flex: 1,
                                minHeight: '44px',
                                padding: '10px 16px',
                                borderRadius: '999px',
                                border: 'none',
                                background:
                                  eternityView === v.key ? tokens.colors.green[600] : 'transparent',
                                color: eternityView === v.key ? '#000' : tokens.colors.text,
                                fontFamily: 'var(--font-cjk)',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: `all ${tokens.duration.base} ${EASE}`,
                              }}
                            >
                              {t(v.labelKey)}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Equipment thumbnails */}
                      {pill.views && (
                        <div
                          role="group"
                          aria-label={t(pill.labelKey) + '相片'}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: '8px',
                            marginBottom: '16px',
                          }}
                        >
                          {pill.views.map((v) => (
                            <button
                              key={v.key}
                              type="button"
                              aria-pressed={equipmentView === v.key}
                              onClick={() => setEquipmentView(v.key)}
                              style={{
                                aspectRatio: '4 / 3',
                                borderRadius: '12px',
                                border: `2px solid ${
                                  equipmentView === v.key
                                    ? tokens.colors.green[600]
                                    : 'rgba(255,255,255,0.1)'
                                }`,
                                overflow: 'hidden',
                                cursor: 'pointer',
                                position: 'relative',
                                background: '#000',
                                transition: `border-color ${tokens.duration.base} ${EASE}`,
                              }}
                            >
                              <Image
                                src={v.image.src}
                                alt=""
                                fill
                                sizes="160px"
                                style={{
                                  objectFit: 'cover',
                                  objectPosition: v.image.objectPosition,
                                }}
                              />
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  padding: '8px',
                                  background:
                                    'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  color: '#fff',
                                }}
                              >
                                {t(v.labelKey)}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Equipment detail card */}
                      {pill.views && (() => {
                        const activeView = pill.views.find((v) => v.key === equipmentView)
                        if (!activeView) return null

                        return (
                          <div
                            aria-live="polite"
                            style={{
                              padding: '16px',
                              borderRadius: '16px',
                              background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            <p
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: '14px',
                                fontWeight: 600,
                                color: tokens.colors.green[600],
                                margin: '0 0 8px',
                              }}
                            >
                              {t(activeView.chipTitleKey)}
                            </p>
                            {activeView.detailTextKey && (
                              <p
                                style={{
                                  fontSize: '13px',
                                  lineHeight: 1.5,
                                  color: 'rgba(255,255,255,0.82)',
                                  margin: 0,
                                }}
                              >
                                {t(activeView.detailTextKey)}
                              </p>
                            )}
                            {activeView.specsKey && (() => {
                              const specs = t.raw(activeView.specsKey) as [string, string][]
                              return (
                                <dl
                                  style={{
                                    display: 'grid',
                                    gap: '8px',
                                    margin: 0,
                                    fontSize: '13px',
                                  }}
                                >
                                  {specs.map(([key, val], i) => (
                                    <div
                                      key={i}
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'auto 1fr',
                                        gap: '12px',
                                      }}
                                    >
                                      <dt style={{ color: 'rgba(255,255,255,0.6)' }}>{key}</dt>
                                      <dd style={{ color: '#fff', margin: 0 }}>{val}</dd>
                                    </div>
                                  ))}
                                </dl>
                              )
                            })()}
                          </div>
                        )
                      })()}

                      {/* Technology intro + points */}
                      {pill.introKey && pill.points && (
                        <div>
                          <p
                            style={{
                              fontSize: '14px',
                              lineHeight: 1.6,
                              color: 'rgba(255,255,255,0.82)',
                              margin: '0 0 20px',
                            }}
                          >
                            {t(pill.introKey)}
                          </p>
                          <ul
                            style={{
                              listStyle: 'none',
                              margin: 0,
                              padding: 0,
                              display: 'grid',
                              gap: '14px',
                            }}
                          >
                            {pill.points.map((pt, i) => (
                              <li
                                key={i}
                                style={{
                                  display: 'flex',
                                  gap: '12px',
                                  paddingBottom: '14px',
                                  borderBottom:
                                    i < pill.points!.length - 1
                                      ? '1px solid rgba(255,255,255,0.06)'
                                      : 'none',
                                }}
                              >
                                <div
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    flexShrink: 0,
                                    color: tokens.colors.green[600],
                                  }}
                                  aria-hidden="true"
                                >
                                  {ICONS[pt.icon]}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      marginBottom: '4px',
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        color: '#fff',
                                      }}
                                    >
                                      {t(pt.nameKey)}
                                    </span>
                                    {pt.tag && (
                                      <span
                                        style={{
                                          fontSize: '10px',
                                          fontWeight: 500,
                                          textTransform: 'uppercase',
                                          letterSpacing: '0.05em',
                                          padding: '3px 7px',
                                          borderRadius: '999px',
                                          border: '1px solid rgba(255,255,255,0.24)',
                                          color: 'rgba(255,255,255,0.72)',
                                        }}
                                      >
                                        {t(pt.tag)}
                                      </span>
                                    )}
                                  </div>
                                  <p
                                    style={{
                                      fontSize: '13px',
                                      lineHeight: 1.6,
                                      color: 'rgba(255,255,255,0.7)',
                                      margin: 0,
                                    }}
                                  >
                                    {t(pt.descKey)}
                                  </p>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Slider track (compare pills only) */}
                      {pill.mode === 'compare' && (
                        <div style={{ marginTop: '24px' }}>
                          <p
                            id={`hint-${pill.id}`}
                            style={{
                              fontSize: '12px',
                              color: 'rgba(255,255,255,0.6)',
                              margin: '0 0 10px',
                            }}
                          >
                            {t('slider_hint')}
                          </p>
                          <div style={{ position: 'relative', height: '6px' }}>
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                borderRadius: '999px',
                                background: 'rgba(255,255,255,0.1)',
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                height: '100%',
                                width: `${dividerPosition}%`,
                                borderRadius: '999px',
                                background: tokens.colors.green[600],
                                transition: prefersReducedMotion
                                  ? 'none'
                                  : `width 200ms ${EASE}`,
                              }}
                            />
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={0.5}
                              value={dividerPosition}
                              aria-labelledby={`hint-${pill.id}`}
                              aria-valuetext={describePosition(dividerPosition)}
                              onChange={(e) => {
                                setTouched(true)
                                if (rafRef.current) cancelAnimationFrame(rafRef.current)
                                setDividerPosition(+e.target.value)
                              }}
                              onKeyDown={handleSliderKeyDown}
                              style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0,
                                cursor: 'ew-resize',
                                zIndex: 2,
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                left: `${dividerPosition}%`,
                                top: '50%',
                                width: '56px',
                                height: '34px',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: '999px',
                                background: tokens.colors.green[600],
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: '#fff',
                                pointerEvents: 'none',
                                transition: prefersReducedMotion
                                  ? 'none'
                                  : `left 200ms ${EASE}`,
                              }}
                            >
                              ‹ ›
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Stage */}
          <div
            id={`panel-${activePill}`}
            role="tabpanel"
            aria-labelledby={activePill}
            ref={stageRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            style={{
              gridArea: 'stage',
              position: 'relative',
              aspectRatio: isDesktop ? '3 / 2' : '4 / 3',
              borderRadius: isDesktop ? '28px' : '20px',
              border: '1px solid rgba(255,255,255,0.08)',
              overflow: 'hidden',
              isolation: 'isolate',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: currentPill.mode === 'compare' ? 'pan-y' : 'auto',
              cursor: isDragging ? 'ew-resize' : 'auto',
              // Technology pill gradient background
              ...(currentPill.id === 'technology' && {
                background: `
                  radial-gradient(58% 56% at 50% 54%, rgba(124, 78, 255, 0.50), transparent 70%),
                  linear-gradient(150deg, #2b1269 0%, #142680 48%, #06061a 100%)
                `,
              }),
              ...((currentPill.id !== 'technology') && {
                background: '#09090a',
              }),
            }}
          >
            {/* Compare mode (renovation, comfort) */}
            {currentPill.mode === 'compare' && currentPill.perRoom && (
              <>
                {/* Infinity layer (left/bottom, clips from right) */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    clipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                    WebkitClipPath: `inset(0 ${100 - dividerPosition}% 0 0)`,
                  }}
                >
                  <Image
                    src={currentPill.perRoom.infinity.src}
                    alt={currentPill.perRoom.infinity.alt}
                    width={currentPill.perRoom.infinity.width}
                    height={currentPill.perRoom.infinity.height}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: currentPill.perRoom.infinity.objectPosition,
                    }}
                    sizes={isDesktop ? '60vw' : '100vw'}
                    priority
                  />
                </div>

                {/* Eternity layer (right/top, clips from left) */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    clipPath: `inset(0 0 0 ${dividerPosition}%)`,
                    WebkitClipPath: `inset(0 0 0 ${dividerPosition}%)`,
                  }}
                >
                  {currentPill.eternityViews ? (
                    // Comfort pill: swap between sofa and bar
                    <>
                      {currentPill.eternityViews.map((v) => (
                        <Image
                          key={v.key}
                          src={v.image.src}
                          alt={v.image.alt}
                          width={v.image.width}
                          height={v.image.height}
                          style={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            objectPosition: v.image.objectPosition,
                            opacity: eternityView === v.key ? 1 : 0,
                            transition: prefersReducedMotion
                              ? 'none'
                              : `opacity 350ms ${EASE}`,
                          }}
                          sizes={isDesktop ? '60vw' : '100vw'}
                          priority
                        />
                      ))}
                    </>
                  ) : (
                    // Renovation pill: single eternity image
                    <Image
                      src={currentPill.perRoom.eternity.src}
                      alt={currentPill.perRoom.eternity.alt}
                      width={currentPill.perRoom.eternity.width}
                      height={currentPill.perRoom.eternity.height}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: currentPill.perRoom.eternity.objectPosition,
                      }}
                      sizes={isDesktop ? '60vw' : '100vw'}
                      priority
                    />
                  )}
                </div>

                {/* Divider line */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${dividerPosition}%`,
                    width: '2px',
                    background: 'rgba(255,255,255,0.92)',
                    zIndex: 3,
                  }}
                >
                  {/* Handle */}
                  <button
                    role="slider"
                    aria-label="拖動以比較兩間球室"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(dividerPosition)}
                    aria-valuetext={describePosition(dividerPosition)}
                    tabIndex={0}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onKeyDown={handleSliderKeyDown}
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '50%',
                      width: isDesktop ? '48px' : '44px',
                      height: isDesktop ? '72px' : '64px',
                      transform: 'translate(-50%, -50%)',
                      borderRadius: '999px',
                      border: '1.5px solid rgba(255,255,255,0.95)',
                      background: 'rgba(16,16,18,0.5)',
                      backdropFilter: 'blur(14px)',
                      WebkitBackdropFilter: 'blur(14px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'ew-resize',
                      touchAction: 'none',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#fff',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = `2px solid ${tokens.colors.green[600]}`
                      e.currentTarget.style.outlineOffset = '2px'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none'
                    }}
                  >
                    ‹ ›
                  </button>
                </div>

                {/* Corner room labels */}
                <button
                  onClick={() => snapToRoom('infinity')}
                  style={{
                    position: 'absolute',
                    bottom: 'clamp(10px, 2vw, 20px)',
                    left: 'clamp(10px, 2vw, 20px)',
                    padding: '9px 14px 10px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'rgba(10,10,12,0.55)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer',
                    opacity: leftOpacity,
                    transition: `opacity 250ms ${EASE}`,
                    zIndex: 4,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      lineHeight: 1.2,
                    }}
                  >
                    {roomLabels.infinity.english}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      lineHeight: 1.2,
                      color: 'rgba(255,255,255,0.82)',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'baseline',
                    }}
                  >
                    <span>{roomLabels.infinity.chinese}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '11px',
                      }}
                    >
                      {roomLabels.infinity.room}
                    </span>
                  </div>
                </button>

                <button
                  onClick={() => snapToRoom('eternity')}
                  style={{
                    position: 'absolute',
                    bottom: 'clamp(10px, 2vw, 20px)',
                    right: 'clamp(10px, 2vw, 20px)',
                    padding: '9px 14px 10px',
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.16)',
                    background: 'rgba(10,10,12,0.55)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    color: '#fff',
                    textAlign: 'right',
                    cursor: 'pointer',
                    opacity: rightOpacity,
                    transition: `opacity 250ms ${EASE}`,
                    zIndex: 4,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      lineHeight: 1.2,
                    }}
                  >
                    {roomLabels.eternity.english}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      lineHeight: 1.2,
                      color: 'rgba(255,255,255,0.82)',
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'baseline',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span>{roomLabels.eternity.chinese}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '11px',
                      }}
                    >
                      {roomLabels.eternity.room}
                    </span>
                  </div>
                </button>
              </>
            )}

            {/* Equipment mode: single image with chip */}
            {currentPill.id === 'equipment' && currentPill.views && (() => {
              const activeView = currentPill.views.find((v) => v.key === equipmentView)
              if (!activeView) return null

              return (
                <>
                  <Image
                    src={activeView.image.src}
                    alt={activeView.image.alt}
                    width={activeView.image.width}
                    height={activeView.image.height}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: activeView.image.objectPosition,
                    }}
                    sizes={isDesktop ? '60vw' : '100vw'}
                  />
                  {/* Chip (product name overlay) */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '20px',
                      left: '20px',
                      padding: '10px 16px',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'rgba(10,10,12,0.65)',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: prefersReducedMotion ? 'none' : `opacity 140ms ${EASE}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-cjk)',
                        fontSize: '11px',
                        color: 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {t(activeView.labelKey)}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#fff',
                      }}
                    >
                      {t(activeView.chipTitleKey)}
                    </span>
                  </div>
                </>
              )
            })()}

            {/* Technology mode: iPad on gradient */}
            {currentPill.id === 'technology' && currentPill.pilotImage && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 22%',
                }}
              >
                <Image
                  src={currentPill.pilotImage.src}
                  alt={currentPill.pilotImage.alt}
                  width={currentPill.pilotImage.width}
                  height={currentPill.pilotImage.height}
                  style={{
                    width: isDesktop ? '52%' : '64%',
                    height: 'auto',
                    maxWidth: '620px',
                    objectFit: 'contain',
                  }}
                  sizes={isDesktop ? '400px' : '300px'}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
