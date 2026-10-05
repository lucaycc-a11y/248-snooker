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

export function RoomViewer({ initialRoom }: { initialRoom?: 'infinity' | 'eternity' }) {
  const t = useTranslations('venue.rooms')

  const [activePill, setActivePill] = useState<PillId>('renovation')
  const [equipmentView, setEquipmentView] = useState<EquipmentViewKey>('table')
  const [eternityView, setEternityView] = useState<EternityViewKey>('sofa')
  const [touched, setTouched] = useState(false)
  const [imageError, setImageError] = useState<Set<string>>(new Set())

  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const pillsRef = useRef<HTMLDivElement>(null)
  const preloadedRef = useRef<Set<string>>(new Set())
  const dividerPosRef = useRef(50)
  const rafRef = useRef<number>(0)
  const driftRanRef = useRef(false)
  const prefersReducedMotion = useRef(false)

  const currentPill = pills.find((p) => p.id === activePill) ?? pills[0]

  // Read ?room= once on mount for initial position
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const room = params.get('room') || initialRoom
    if (room === 'infinity') dividerPosRef.current = 100
    else if (room === 'eternity') dividerPosRef.current = 0
    else dividerPosRef.current = 50

    prefersReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (sectionRef.current) {
      sectionRef.current.style.setProperty('--p', String(dividerPosRef.current))
    }
  }, [initialRoom])

  // Update CSS custom property
  const updateDividerCSS = useCallback((value: number) => {
    dividerPosRef.current = value
    if (sectionRef.current) {
      sectionRef.current.style.setProperty('--p', String(value))
    }
  }, [])

  // Preload image with cache
  const handlePreload = useCallback(async (src: string) => {
    if (!preloadedRef.current.has(src)) {
      try {
        await preloadImage(src)
        preloadedRef.current.add(src)
      } catch (err) {
        console.error(`Preload failed for ${src}:`, err)
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
        if (pill.views) {
          pill.views.forEach((v) => handlePreload(v.image.src))
        }
        if (pill.eternityViews) {
          pill.eternityViews.forEach((v) => handlePreload(v.image.src))
        }
        if (pill.pilotImage) {
          handlePreload(pill.pilotImage.src)
        }
      })
    }, 1000)
    return () => clearTimeout(timer)
  }, [handlePreload])

  // Tween divider (for drift and snaps)
  const tweenDivider = useCallback(
    async (target: number, duration = 420) => {
      return new Promise<void>((resolve) => {
        const start = dividerPosRef.current
        const distance = target - start
        const startTime = performance.now()

        const animate = (now: number) => {
          const elapsed = now - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const current = start + distance * eased

          updateDividerCSS(current)

          if (progress < 1) {
            rafRef.current = requestAnimationFrame(animate)
          } else {
            resolve()
          }
        }

        rafRef.current = requestAnimationFrame(animate)
      })
    },
    [updateDividerCSS]
  )

  // Drift animation on first view (once per page load)
  useEffect(() => {
    if (prefersReducedMotion.current || driftRanRef.current || !stageRef.current) return
    if (currentPill.mode !== 'compare') return

    const observer = new IntersectionObserver(
      async (entries, obs) => {
        if (!entries[0].isIntersecting || driftRanRef.current) return
        obs.disconnect()
        driftRanRef.current = true

        // Wait for images to load before drifting
        const { perRoom } = currentPill
        if (!perRoom) return
        try {
          await Promise.all([
            handlePreload(perRoom.infinity.src),
            handlePreload(perRoom.eternity.src),
          ])
        } catch {
          return
        }

        setTimeout(async () => {
          if (touched) return
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
  }, [currentPill, touched, tweenDivider, handlePreload])

  // Handle divider drag
  const handlePointerDown = (e: React.PointerEvent) => {
    if (currentPill.mode !== 'compare') return
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    // Touch: only drag near divider (within 44px); mouse/pen: anywhere
    if (e.pointerType === 'touch' && Math.abs(x - (rect.width * dividerPosRef.current) / 100) > 44) {
      return
    }

    e.preventDefault()
    setTouched(true)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    stageRef.current?.setPointerCapture(e.pointerId)

    const drag = (ev: PointerEvent) => {
      const r = stageRef.current?.getBoundingClientRect()
      if (!r) return
      const nx = ev.clientX - r.left
      updateDividerCSS(Math.max(0, Math.min(100, (nx / r.width) * 100)))
    }

    const up = (ev: PointerEvent) => {
      stageRef.current?.releasePointerCapture(ev.pointerId)
      window.removeEventListener('pointermove', drag)
      window.removeEventListener('pointerup', up)
    }

    window.addEventListener('pointermove', drag)
    window.addEventListener('pointerup', up)
    drag(e.nativeEvent)
  }

  // Snap to room
  const snapToRoom = (room: 'infinity' | 'eternity') => {
    setTouched(true)
    tweenDivider(room === 'infinity' ? 100 : 0)
  }

  // Handle Eternity view switch
  const handleEternitySwitch = (key: EternityViewKey) => {
    if (key === eternityView) return
    setEternityView(key)
    // If divider shows mostly Infinity (>60%), ease it to show Eternity
    if (dividerPosRef.current > 60) {
      tweenDivider(40)
    }
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
    // No focus() call - let browser handle focus naturally
  }

  // Handle slider keyboard navigation
  const handleSliderKeyDown = (e: React.KeyboardEvent) => {
    if (currentPill.mode !== 'compare') return

    let newPos = dividerPosRef.current

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      newPos = Math.max(0, dividerPosRef.current - 5)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      newPos = Math.min(100, dividerPosRef.current + 5)
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
    updateDividerCSS(newPos)
  }

  // Describe position for a11y
  const describePosition = (pos: number): string => {
    if (pos < 20) return `${t('eternity.name')} 全景`
    if (pos > 80) return `${t('infinity.name')} 全景`
    return `${Math.round(pos)}% ${t('infinity.name')}`
  }

  // Handle image error
  const handleImageError = (src: string) => {
    console.error(`Image failed to load: ${src}`)
    setImageError((prev) => new Set(prev).add(src))
  }

  return (
    <section
      ref={sectionRef}
      className="venue-room-viewer"
      style={{
        minHeight: '100svh',
        paddingTop: 'var(--navbar-height, 64px)',
        paddingBottom: 'clamp(48px, 8vw, 96px)',
        paddingInline: 'clamp(16px, 4vw, 48px)',
        background: '#000',
        color: tokens.colors.text,
        // CSS custom property for divider position
        '--p': '50',
      } as React.CSSProperties}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(28px, 4.4vw, 48px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#fff',
            margin: '0 0 clamp(18px, 2.6vw, 32px)',
          }}
        >
          {t('title')}
        </h2>

        {/* Layout: CSS-only responsive, no JS breakpoint */}
        <div className="room-viewer-grid">
          {/* Side: Pills */}
          <div
            ref={pillsRef}
            role="tablist"
            aria-label="房間特色"
            className="pills-container"
          >
            {pills.map((pill) => {
              const isActive = pill.id === activePill
              return (
                <div key={pill.id} className="pill-wrapper">
                  <button
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`panel-${pill.id}`}
                    id={`tab-${pill.id}`}
                    onClick={() => setActivePill(pill.id)}
                    onKeyDown={(e) => handlePillKeyDown(e, pill.id)}
                    className={`pill-button ${isActive ? 'active' : ''}`}
                  >
                    <div className="pill-header">
                      {/* Plus/minus icon (desktop only) */}
                      <div className="pill-icon" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M6 1v10M1 6h10"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      {/* Label */}
                      <span className="pill-label">{t(pill.labelKey)}</span>

                      {/* Tag */}
                      {pill.tag && (
                        <span className="pill-tag">
                          {t(pill.tag)}
                        </span>
                      )}
                    </div>

                    {/* Expanded panel content (desktop only when active) */}
                    {isActive && (
                      <div className="pill-panel">
                        <p className="pill-main">
                          {t(pill.mainLineKey)}
                        </p>

                        {/* Eternity switch (comfort pill) */}
                        {pill.eternityViews && (
                          <div
                            role="group"
                            aria-label="Space Eternity 檢視"
                            className="eternity-switch"
                          >
                            {pill.eternityViews.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                aria-pressed={eternityView === v.key}
                                onClick={() => handleEternitySwitch(v.key)}
                                className={`eternity-btn ${eternityView === v.key ? 'active' : ''}`}
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
                            className="equipment-thumbnails"
                          >
                            {pill.views.map((v) => (
                              <button
                                key={v.key}
                                type="button"
                                aria-pressed={equipmentView === v.key}
                                onClick={() => setEquipmentView(v.key)}
                                className={`equipment-thumb ${equipmentView === v.key ? 'active' : ''}`}
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
                                  onError={() => handleImageError(v.image.src)}
                                />
                                <div className="equipment-thumb-label">
                                  {t(v.labelKey)}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Technology intro + points */}
                        {pill.introKey && pill.points && (
                          <div className="technology-panel">
                            <p className="technology-intro">
                              {t(pill.introKey)}
                            </p>
                            <ul className="technology-points">
                              {pill.points.map((pt, i) => (
                                <li key={i} className="technology-point">
                                  <div className="technology-point-header">
                                    <div className="technology-point-icon">
                                      {ICONS[pt.icon]}
                                    </div>
                                    <span className="technology-point-name">
                                      {t(pt.nameKey)}
                                    </span>
                                    {pt.tag && (
                                      <span className="pill-tag">
                                        {t(pt.tag)}
                                      </span>
                                    )}
                                  </div>
                                  <p className="technology-point-desc">
                                    {t(pt.descKey)}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Slider track (compare pills only) */}
                        {pill.mode === 'compare' && (
                          <div className="slider-track-wrapper">
                            <p id={`hint-${pill.id}`} className="slider-hint">
                              {t('slider_hint')}
                            </p>
                            <div className="slider-track">
                              <div className="slider-track-bg" />
                              <div
                                className="slider-track-fill"
                                style={{ width: `var(--p, 50)%` }}
                              />
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={0.5}
                                value={dividerPosRef.current}
                                aria-labelledby={`hint-${pill.id}`}
                                aria-valuetext={describePosition(dividerPosRef.current)}
                                onChange={(e) => {
                                  setTouched(true)
                                  if (rafRef.current) cancelAnimationFrame(rafRef.current)
                                  updateDividerCSS(+e.target.value)
                                }}
                                onKeyDown={handleSliderKeyDown}
                                className="slider-input"
                              />
                              <div
                                className="slider-thumb"
                                style={{ left: `var(--p, 50)%` }}
                              >
                                ‹ ›
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Stage: Right column (desktop) / Top (mobile) */}
          <div
            ref={stageRef}
            role="tabpanel"
            id={`panel-${currentPill.id}`}
            aria-labelledby={`tab-${currentPill.id}`}
            className="stage"
            onPointerDown={handlePointerDown}
          >
            <div className="stage-inner">
              {/* Compare mode: two panoramas with divider */}
              {currentPill.mode === 'compare' && currentPill.perRoom && (
                <div className="compare-stage">
                  {/* Bottom layer: Infinity */}
                  <div className="compare-layer compare-layer-infinity">
                    {!imageError.has(currentPill.perRoom.infinity.src) ? (
                      <Image
                        src={currentPill.perRoom.infinity.src}
                        alt={currentPill.perRoom.infinity.alt}
                        fill
                        sizes="(max-width: 1023px) 100vw, 65vw"
                        priority={currentPill.id === 'renovation'}
                        style={{
                          objectFit: 'cover',
                          objectPosition: currentPill.perRoom.infinity.objectPosition,
                        }}
                        onError={() => handleImageError(currentPill.perRoom!.infinity.src)}
                      />
                    ) : (
                      <div className="image-placeholder" />
                    )}
                  </div>

                  {/* Top layer: Eternity (clipped from left) */}
                  <div
                    className="compare-layer compare-layer-eternity"
                    style={{
                      clipPath: `inset(0 0 0 calc(var(--p, 50) * 1%))`,
                      WebkitClipPath: `inset(0 0 0 calc(var(--p, 50) * 1%))`,
                    }}
                  >
                    {!imageError.has(
                      pill.eternityViews && eternityView !== 'sofa'
                        ? pill.eternityViews.find((v) => v.key === eternityView)!.image.src
                        : currentPill.perRoom.eternity.src
                    ) ? (
                      <Image
                        src={
                          currentPill.eternityViews && eternityView !== 'sofa'
                            ? currentPill.eternityViews.find((v) => v.key === eternityView)!.image.src
                            : currentPill.perRoom.eternity.src
                        }
                        alt={
                          currentPill.eternityViews && eternityView !== 'sofa'
                            ? currentPill.eternityViews.find((v) => v.key === eternityView)!.image.alt
                            : currentPill.perRoom.eternity.alt
                        }
                        fill
                        sizes="(max-width: 1023px) 100vw, 65vw"
                        priority={currentPill.id === 'renovation'}
                        style={{
                          objectFit: 'cover',
                          objectPosition:
                            currentPill.eternityViews && eternityView !== 'sofa'
                              ? currentPill.eternityViews.find((v) => v.key === eternityView)!.image.objectPosition
                              : currentPill.perRoom.eternity.objectPosition,
                        }}
                        onError={() =>
                          handleImageError(
                            currentPill.eternityViews && eternityView !== 'sofa'
                              ? currentPill.eternityViews.find((v) => v.key === eternityView)!.image.src
                              : currentPill.perRoom.eternity.src
                          )
                        }
                      />
                    ) : (
                      <div className="image-placeholder" />
                    )}
                  </div>

                  {/* Divider handle */}
                  <div
                    className="divider-handle"
                    style={{ left: `var(--p, 50)%` }}
                    aria-hidden="true"
                  >
                    <div className="divider-line" />
                    <div className="divider-capsule">‹ ›</div>
                  </div>

                  {/* Corner room labels */}
                  <button
                    type="button"
                    onClick={() => snapToRoom('infinity')}
                    className="room-label room-label-infinity"
                    style={{
                      opacity: dividerPosRef.current < 20 ? 0.4 : 1,
                    }}
                    aria-label={`顯示 ${t('infinity.name')}`}
                  >
                    <div className="room-label-english">{roomLabels.infinity.english}</div>
                    <div className="room-label-chinese">{roomLabels.infinity.chinese}</div>
                    <div className="room-label-room">{roomLabels.infinity.room}</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => snapToRoom('eternity')}
                    className="room-label room-label-eternity"
                    style={{
                      opacity: dividerPosRef.current > 80 ? 0.4 : 1,
                    }}
                    aria-label={`顯示 ${t('eternity.name')}`}
                  >
                    <div className="room-label-english">{roomLabels.eternity.english}</div>
                    <div className="room-label-chinese">{roomLabels.eternity.chinese}</div>
                    <div className="room-label-room">{roomLabels.eternity.room}</div>
                  </button>
                </div>
              )}

              {/* Equipment mode: single image with chip + detail */}
              {currentPill.mode === 'single' && currentPill.views && (
                <div className="equipment-stage">
                  {(() => {
                    const view = currentPill.views.find((v) => v.key === equipmentView)!
                    return (
                      <>
                        {!imageError.has(view.image.src) ? (
                          <Image
                            src={view.image.src}
                            alt={view.image.alt}
                            fill
                            sizes="(max-width: 1023px) 100vw, 65vw"
                            style={{
                              objectFit: 'cover',
                              objectPosition: view.image.objectPosition,
                            }}
                            onError={() => handleImageError(view.image.src)}
                          />
                        ) : (
                          <div className="image-placeholder" />
                        )}

                        {/* Glass chip overlay */}
                        <div className="equipment-chip">
                          <div className="equipment-chip-label">{t(view.labelKey)}</div>
                          <div className="equipment-chip-title">{t(view.chipTitleKey)}</div>
                        </div>

                        {/* Detail card (mobile only) */}
                        <div className="equipment-detail-mobile">
                          {view.detailTextKey && (
                            <p className="equipment-detail-text">{t(view.detailTextKey)}</p>
                          )}
                          {view.specsKey && (
                            <table className="equipment-specs">
                              <tbody>
                                {(t.raw(view.specsKey) as string[][]).map(([label, value], i) => (
                                  <tr key={i}>
                                    <th>{label}</th>
                                    <td>{value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}

              {/* Technology mode: gradient + iPad */}
              {currentPill.mode === 'single' && currentPill.pilotImage && (
                <div className="technology-stage">
                  {!imageError.has(currentPill.pilotImage.src) ? (
                    <Image
                      src={currentPill.pilotImage.src}
                      alt={currentPill.pilotImage.alt}
                      width={currentPill.pilotImage.width}
                      height={currentPill.pilotImage.height}
                      className="technology-ipad"
                      style={{
                        width: '52%',
                        height: 'auto',
                        maxWidth: '480px',
                      }}
                      onError={() => handleImageError(currentPill.pilotImage!.src)}
                    />
                  ) : (
                    <div className="image-placeholder" style={{ width: '52%', aspectRatio: '3/4' }} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .room-viewer-grid {
          display: grid;
          grid-template-columns: 1fr;
          grid-template-areas: 'stage' 'side';
          gap: 18px;
        }

        @media (min-width: 1024px) {
          .room-viewer-grid {
            grid-template-columns: minmax(300px, 380px) minmax(0, 1fr);
            grid-template-areas: 'side stage';
            gap: 32px;
          }
        }

        .pills-container {
          grid-area: side;
          display: flex;
          flex-direction: row;
          gap: 10px;
          overflow-x: auto;
          scroll-snap-type: x proximity;
          scrollbar-width: none;
          margin-inline: calc(-1 * clamp(16px, 4vw, 48px));
          padding-inline: clamp(16px, 4vw, 48px);
        }

        .pills-container::-webkit-scrollbar {
          display: none;
        }

        @media (min-width: 1024px) {
          .pills-container {
            flex-direction: column;
            gap: 12px;
            overflow-x: visible;
            margin-inline: 0;
            padding-inline: 0;
          }
        }

        .pill-wrapper {
          min-width: 0;
          width: 100%;
        }

        @media (max-width: 1023px) {
          .pill-wrapper {
            min-width: 200px;
            scroll-snap-align: start;
          }
        }

        .pill-button {
          width: 100%;
          min-height: 44px;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          color: rgba(255, 255, 255, 0.8);
          font-family: var(--font-cjk);
          font-size: 14px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: all ${tokens.duration.base} ${EASE};
        }

        .pill-button:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .pill-button.active {
          background: rgba(255, 255, 255, 0.08);
          border-color: ${tokens.colors.green[600]};
          color: #fff;
        }

        .pill-header {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .pill-icon {
          display: none;
        }

        @media (min-width: 1024px) {
          .pill-icon {
            display: flex;
            flex: none;
            width: 18px;
            height: 18px;
            align-items: center;
            justify-content: center;
            color: currentColor;
            transition: transform 160ms ${POP};
          }

          .pill-button.active .pill-icon {
            transform: rotate(45deg);
          }
        }

        .pill-label {
          flex: 1;
          min-width: 0;
        }

        .pill-tag {
          flex: none;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 4px 9px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          color: rgba(255, 255, 255, 0.72);
          white-space: nowrap;
        }

        .pill-panel {
          display: none;
        }

        @media (min-width: 1024px) {
          .pill-button.active .pill-panel {
            display: block;
            margin-top: 16px;
          }
        }

        .pill-main {
          font-size: 15px;
          line-height: 1.4;
          color: rgba(255, 255, 255, 0.9);
          margin: 0 0 16px;
          overflow-wrap: anywhere;
        }

        .eternity-switch {
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.06);
          margin-bottom: 16px;
        }

        .eternity-btn {
          flex: 1;
          min-height: 44px;
          padding: 10px 16px;
          border-radius: 999px;
          border: none;
          background: transparent;
          color: ${tokens.colors.text};
          font-family: var(--font-cjk);
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all ${tokens.duration.base} ${EASE};
        }

        .eternity-btn.active {
          background: ${tokens.colors.green[600]};
          color: #000;
        }

        .equipment-thumbnails {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-bottom: 16px;
        }

        .equipment-thumb {
          aspect-ratio: 4 / 3;
          border-radius: 12px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
          cursor: pointer;
          position: relative;
          background: #000;
          transition: border-color ${tokens.duration.base} ${EASE};
        }

        .equipment-thumb.active {
          border-color: ${tokens.colors.green[600]};
        }

        .equipment-thumb-label {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 8px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent);
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }

        .technology-panel {
          min-width: 0;
        }

        .technology-intro {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.8);
          margin: 0 0 18px;
          overflow-wrap: anywhere;
        }

        .technology-points {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .technology-point {
          padding: 16px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .technology-point:last-child {
          border-bottom: none;
        }

        .technology-point-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
          min-width: 0;
        }

        .technology-point-icon {
          flex: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.8);
        }

        .technology-point-name {
          flex: 1;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          min-width: 0;
        }

        .technology-point-desc {
          font-size: 13px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.7);
          margin: 0;
          overflow-wrap: anywhere;
        }

        .slider-track-wrapper {
          margin-top: 24px;
        }

        .slider-hint {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          margin: 0 0 10px;
        }

        .slider-track {
          position: relative;
          height: 6px;
        }

        .slider-track-bg {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }

        .slider-track-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 999px;
          background: ${tokens.colors.green[600]};
          transition: width 200ms ${EASE};
        }

        @media (prefers-reduced-motion: reduce) {
          .slider-track-fill {
            transition: none;
          }
        }

        .slider-input {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: ew-resize;
          z-index: 2;
        }

        .slider-thumb {
          position: absolute;
          top: 50%;
          width: 56px;
          height: 34px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: ${tokens.colors.green[600]};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.1em;
          pointer-events: none;
          z-index: 1;
        }

        .stage {
          grid-area: stage;
          position: relative;
        }

        @media (min-width: 1024px) {
          .stage {
            position: sticky;
            top: var(--navbar-height, 64px);
            align-self: start;
          }
        }

        .stage-inner {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          background: #000;
          border-radius: 16px;
          overflow: hidden;
        }

        @media (max-width: 639px) {
          .stage-inner {
            aspect-ratio: 4 / 3;
          }
        }

        @media (min-width: 640px) and (max-width: 1023px) {
          .stage-inner {
            aspect-ratio: 3 / 2;
          }
        }

        .compare-stage {
          position: absolute;
          inset: 0;
        }

        .compare-layer {
          position: absolute;
          inset: 0;
        }

        .compare-layer-infinity {
          z-index: 1;
        }

        .compare-layer-eternity {
          z-index: 2;
        }

        .divider-handle {
          position: absolute;
          top: 0;
          bottom: 0;
          transform: translateX(-50%);
          z-index: 10;
          pointer-events: none;
        }

        .divider-line {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 2px;
          background: rgba(255, 255, 255, 0.95);
          transform: translateX(-50%);
        }

        .divider-capsule {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 44px;
          height: 64px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.1em;
        }

        .room-label {
          position: absolute;
          bottom: 16px;
          padding: 10px 14px;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(8px);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          cursor: pointer;
          transition: opacity 240ms ${EASE};
          z-index: 5;
        }

        .room-label-infinity {
          right: 16px;
          text-align: right;
        }

        .room-label-eternity {
          left: 16px;
          text-align: left;
        }

        .room-label-english {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 2px;
        }

        .room-label-chinese {
          font-size: 13px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.95);
          margin-bottom: 2px;
        }

        .room-label-room {
          font-size: 10px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.5);
        }

        .equipment-stage,
        .technology-stage {
          position: absolute;
          inset: 0;
        }

        .equipment-chip {
          position: absolute;
          top: 20px;
          left: 20px;
          padding: 12px 18px;
          background: rgba(0, 0, 0, 0.64);
          backdrop-filter: blur(12px);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          z-index: 5;
        }

        .equipment-chip-label {
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 4px;
        }

        .equipment-chip-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 700;
          color: #fff;
        }

        .equipment-detail-mobile {
          display: block;
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 20px;
          background: linear-gradient(to top, rgba(0, 0, 0, 0.92), transparent);
        }

        @media (min-width: 1024px) {
          .equipment-detail-mobile {
            display: none;
          }
        }

        .equipment-detail-text {
          font-size: 14px;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
        }

        .equipment-specs {
          width: 100%;
          margin-top: 12px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.85);
          border-collapse: collapse;
        }

        .equipment-specs th {
          text-align: left;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
          padding: 6px 12px 6px 0;
          white-space: nowrap;
        }

        .equipment-specs td {
          padding: 6px 0;
        }

        .technology-stage {
          display: grid;
          place-items: center;
          background: radial-gradient(
              ellipse 60% 50% at 50% 48%,
              rgba(124, 78, 255, 0.50),
              transparent
            ),
            linear-gradient(135deg, #2b1269 0%, #142680 50%, #06061a 100%);
        }

        .technology-ipad {
          object-fit: contain;
          filter: drop-shadow(0 24px 48px rgba(0, 0, 0, 0.4));
        }

        @media (max-width: 639px) {
          .technology-ipad {
            width: 64% !important;
          }
        }

        .image-placeholder {
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          color: rgba(255, 255, 255, 0.3);
          font-size: 14px;
        }
      `}</style>
    </section>
  )
}
