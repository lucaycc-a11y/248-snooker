'use client'

/* eslint-disable @next/next/no-img-element -- plain <img> on purpose: the WebP files are already optimised, and it avoids next/image
   optimiser/quality config problems. The component decodes images before cross-fading, so the stage never goes blank. */

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import styles from './RoomViewer.module.css'
import { ROOM_VIEWER_DATA } from './room-viewer.data'
import type { IconKey, Img, PillData, RoomViewerData } from './room-viewer.data'

/* ───────────── small helpers ───────────── */

const ICONS: Record<IconKey, ReactNode> = {
  spark: <path d="M12 3.5l1.9 5.4 5.4 1.9-5.4 1.9-1.9 5.4-1.9-5.4-5.4-1.9 5.4-1.9z" />,
  timer: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 13.5V9.5M9.5 3.5h5" />
    </>
  ),
  bars: <path d="M5.5 19.5v-6M12 19.5v-14M18.5 19.5V9.5" />,
  play: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10.2 8.6l5 3.4-5 3.4z" />
    </>
  ),
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

function describe(p: number) {
  if (p >= 96) return '只顯示 Space Infinity'
  if (p <= 4) return '只顯示 Space Eternity'
  return `左邊 Space Infinity，右邊 Space Eternity，分界線在 ${Math.round(p)}%`
}

/** A stage photo. If it fails to load it hides itself (no broken-image icon, no alt text on the stage) and logs an error. */
function Photo({ img, className, lazy = false, on }: { img: Img; className?: string; lazy?: boolean; on?: boolean }) {
  return (
    <img
      className={className}
      data-on={on}
      src={img.src}
      alt={img.alt}
      width={img.width}
      height={img.height}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
      draggable={false}
      style={{ ['--pos' as string]: img.pos ?? '50% 50%' }}
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden'
        // eslint-disable-next-line no-console
        console.error(`[RoomViewer] image failed to load: ${img.src}`)
      }}
    />
  )
}

interface Props {
  /** Defaults to the zh-HK data in room-viewer.data.ts */
  data?: RoomViewerData
  className?: string
}

/* ───────────── component ───────────── */

export default function RoomViewer({ data = ROOM_VIEWER_DATA, className }: Props) {
  const { pills, rooms } = data
  const uid = useId()

  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const rowRef = useRef<HTMLDivElement>(null)

  /* the divider value lives in a ref and is written to a CSS variable (never React state: no re-render while dragging) */
  const pRef = useRef(50)
  const rafRef = useRef(0)
  const touchedRef = useRef(false)
  const driftedRef = useRef(false)
  const reduceRef = useRef(false)
  const dragRef = useRef(false)
  const switchToken = useRef(0)
  const sceneRef = useRef(pills[0].id)

  const [activeId, setActiveId] = useState(pills[0].id) // tab + panel
  const [sceneId, setSceneId] = useState(pills[0].id) // stage (switches after the next photos are decoded)
  const [eterKey, setEterKey] = useState<string>('sofa')
  const proPill = pills.find((p) => p.views)
  const [proKey, setProKey] = useState(proPill?.views?.[0].key ?? '')
  const [proShown, setProShown] = useState(proPill?.views?.[0].key ?? '')
  const [swap, setSwap] = useState(false)

  const scenePill = pills.find((p) => p.id === sceneId) ?? pills[0]
  const mode = scenePill.compare ? 'compare' : 'single'

  /* ───── divider ───── */
  const setP = useCallback((v: number) => {
    const p = clamp(v)
    pRef.current = p
    const root = rootRef.current
    const stage = stageRef.current
    if (!root || !stage) return
    root.style.setProperty('--p', p.toFixed(2))
    stage.dataset.edge = p < 22 ? 'l' : p > 78 ? 'r' : ''
    const txt = describe(p)
    root.querySelectorAll<HTMLInputElement>('input[data-rv-range]').forEach((r) => {
      r.value = String(p)
      r.setAttribute('aria-valuetext', txt)
    })
  }, [])

  const tween = useCallback(
    (to: number, ms = 360) => {
      cancelAnimationFrame(rafRef.current)
      if (reduceRef.current) {
        setP(to)
        return Promise.resolve()
      }
      const from = pRef.current
      const t0 = performance.now()
      return new Promise<void>((resolve) => {
        const step = (now: number) => {
          const k = Math.min(1, (now - t0) / ms)
          const e = 1 - Math.pow(1 - k, 3)
          setP(from + (to - from) * e)
          if (k < 1) rafRef.current = requestAnimationFrame(step)
          else resolve()
        }
        rafRef.current = requestAnimationFrame(step)
      })
    },
    [setP],
  )

  /* mouse and pen drag anywhere on the stage; touch only near the divider so vertical page scrolling stays free */
  const onStageDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    if (!stage || mode !== 'compare') return
    if ((e.target as HTMLElement).closest('[data-rv-label]')) return
    const r = stage.getBoundingClientRect()
    const x = e.clientX - r.left
    if (e.pointerType === 'touch' && Math.abs(x - (r.width * pRef.current) / 100) > 44) return
    dragRef.current = true
    touchedRef.current = true
    cancelAnimationFrame(rafRef.current)
    stage.setPointerCapture(e.pointerId)
    setP((x / r.width) * 100)
  }
  const onStageMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current
    if (!dragRef.current || !stage) return
    const r = stage.getBoundingClientRect()
    setP(((e.clientX - r.left) / r.width) * 100)
  }
  const endDrag = () => {
    dragRef.current = false
  }

  /* ───── tabs ───── */
  const alignPill = useCallback((id: string) => {
    const row = rowRef.current
    if (!row || window.matchMedia('(min-width:1024px)').matches) return
    const idx = pills.findIndex((p) => p.id === id)
    const item = row.children[idx] as HTMLElement | undefined
    if (!item) return
    const pad = 16
    const max = Math.max(0, row.scrollWidth - row.clientWidth)
    const isLast = idx === pills.length - 1
    // chosen pill goes to the left edge so the next one peeks in at the right; the last pill goes to the right edge
    const left = isLast ? item.offsetLeft + item.offsetWidth + pad - row.clientWidth : item.offsetLeft - pad
    row.scrollTo({ left: clamp(left, 0, max), behavior: reduceRef.current ? 'auto' : 'smooth' })
  }, [pills])

  const select = useCallback(
    (id: string, focus = false) => {
      setActiveId(id)
      const token = ++switchToken.current
      // keep the old photo on stage until the next ones are decoded (max 1.5s), so the stage is never blank
      const imgs = Array.from(stageRef.current?.querySelectorAll<HTMLImageElement>(`[data-scene="${id}"] img`) ?? [])
      const ready = Promise.all(
        imgs.map((i) => (i.complete && i.naturalWidth > 0 ? 0 : typeof i.decode === 'function' ? i.decode().catch(() => 0) : 0)),
      )
      Promise.race([ready, new Promise((r) => setTimeout(r, 1500))]).then(() => {
        if (token !== switchToken.current) return
        sceneRef.current = id
        setSceneId(id)
      })
      alignPill(id)
      if (focus) requestAnimationFrame(() => rootRef.current?.querySelector<HTMLElement>(`[data-tab="${id}"]`)?.focus({ preventScroll: true }))
    },
    [alignPill],
  )

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!(e.target as HTMLElement).closest('[role="tab"]')) return
    let i = pills.findIndex((p) => p.id === activeId)
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (i + 1) % pills.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (i - 1 + pills.length) % pills.length
    else if (e.key === 'Home') i = 0
    else if (e.key === 'End') i = pills.length - 1
    else return
    e.preventDefault()
    select(pills[i].id, true)
  }

  const pickEter = (key: string) => {
    setEterKey(key)
    touchedRef.current = true
    if (pRef.current > 60) tween(40) // make sure the Eternity side is visible
  }
  const pickPro = (key: string) => {
    if (key === proKey) return
    setProKey(key)
    setSwap(true)
    window.setTimeout(() => {
      setProShown(key)
      setSwap(false)
    }, reduceRef.current ? 0 : 140)
  }

  /* ───── effects ───── */
  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // ?room=infinity|eternity sets the starting position once. The component never writes to the URL.
    const room = new URLSearchParams(window.location.search).get('room')
    if (room === 'infinity') {
      setP(100)
      touchedRef.current = true
    } else if (room === 'eternity') {
      setP(0)
      touchedRef.current = true
    }
  }, [setP])

  // warm the cache for every stage photo after idle
  useEffect(() => {
    const urls: string[] = []
    pills.forEach((p) => {
      if (p.compare) {
        urls.push(p.compare.infinity.src)
        ;(Array.isArray(p.compare.eternity) ? p.compare.eternity : [p.compare.eternity]).forEach((v) => urls.push(v.src))
      }
      p.views?.forEach((v) => urls.push(v.src))
      if (p.pilot) urls.push(p.pilot.image.src)
    })
    const run = () =>
      urls.forEach((u) => {
        const im = new Image()
        im.src = u
        im.decode?.().catch(() => undefined)
      })
    // requestIdleCallback is missing in Safari, so fall back to a timer
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(run)
      return () => w.cancelIdleCallback?.(id)
    }
    const t = window.setTimeout(run, 800)
    return () => window.clearTimeout(t)
  }, [pills])

  // one quiet hint when the stage first scrolls into view: the divider drifts left, then right, then home
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || reduceRef.current) return
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        if (driftedRef.current) return
        driftedRef.current = true
        await new Promise((r) => setTimeout(r, 400))
        const loaded = Array.from(stage.querySelectorAll<HTMLImageElement>('[data-scene] img')).slice(0, 2).every((i) => i.complete && i.naturalWidth > 0)
        if (touchedRef.current || !loaded || sceneRef.current !== pills[0].id) return
        await tween(36, 520)
        if (touchedRef.current) return
        await tween(64, 760)
        if (touchedRef.current) return
        await tween(50, 520)
      },
      { threshold: 0.6 },
    )
    io.observe(stage)
    return () => {
      io.disconnect()
      cancelAnimationFrame(rafRef.current)
    }
  }, [pills, tween])

  /* ───── panels (rendered once inside each pill for ≥1024px, once under the row for phones) ───── */
  const renderPanel = (pill: PillData, where: 'desk' | 'mob') => {
    const hintId = `${uid}-hint-${pill.id}-${where}`
    const eterViews = pill.compare && Array.isArray(pill.compare.eternity) ? pill.compare.eternity : null
    const view = pill.views?.find((v) => v.key === proShown)
    return (
      <div
        className={styles.panel}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${pill.id}`}
        id={`${uid}-panel-${pill.id}-${where}`}
      >
        <div className={styles.panelIn}>
          <p className={styles.main}>{pill.main}</p>

          {pill.views && (
            <>
              <div className={styles.thumbs} role="group" aria-label={`${pill.name}相片`}>
                {pill.views.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className={styles.thumb}
                    data-on={proKey === v.key}
                    aria-pressed={proKey === v.key}
                    onClick={() => pickPro(v.key)}
                  >
                    <span className={styles.thumbImg}>
                      <img src={v.src} alt="" loading="lazy" decoding="async" draggable={false} style={{ ['--pos' as string]: v.pos ?? '50% 50%' }} />
                    </span>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
              <div className={styles.info} data-swap={swap} aria-live="polite">
                {view?.sub && <p className={styles.infoSub}>{view.sub}</p>}
                {view?.rows && (
                  <dl className={styles.spec}>
                    {view.rows.map(([k, val]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{val}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </>
          )}

          {pill.pilot && (
            <>
              <p className={styles.intro}>{pill.pilot.intro}</p>
              <ul className={styles.points}>
                {pill.pilot.points.map((pt) => (
                  <li key={pt.name} className={styles.pt}>
                    <span className={styles.ptIc}>
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        {ICONS[pt.icon]}
                      </svg>
                    </span>
                    <span className={styles.ptBody}>
                      <span className={styles.ptName}>
                        <span>{pt.name}</span>
                        {pt.tag && <span className={styles.tag}>{pt.tag}</span>}
                      </span>
                      <span className={styles.ptDesc}>{pt.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {eterViews && (
            <div className={styles.seg}>
              <div className={styles.segTrack} role="group" aria-label="Space Eternity 檢視">
                {eterViews.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    className={styles.segBtn}
                    data-on={eterKey === v.key}
                    aria-pressed={eterKey === v.key}
                    onClick={() => pickEter(v.key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pill.compare && (
            <div className={styles.compare}>
              <p className={styles.hint} id={hintId}>
                {data.hint}
              </p>
              <input
                className={styles.range}
                type="range"
                min={0}
                max={100}
                step={0.5}
                defaultValue={50}
                data-rv-range=""
                aria-labelledby={hintId}
                aria-valuetext={describe(50)}
                onChange={(e) => {
                  touchedRef.current = true
                  cancelAnimationFrame(rafRef.current)
                  setP(+e.currentTarget.value)
                }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  const activePill = pills.find((p) => p.id === activeId) ?? pills[0]
  const shownView = proPill?.views?.find((v) => v.key === proShown)

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(' ')} aria-labelledby={`${uid}-title`}>
      <h2 className={styles.title} id={`${uid}-title`}>
        {data.title}
      </h2>

      <div className={styles.grid}>
        {/* ───── stage ───── */}
        <div
          ref={stageRef}
          className={styles.stage}
          data-mode={mode}
          onPointerDown={onStageDown}
          onPointerMove={onStageMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {pills.map((p, pi) => {
            const eter = p.compare ? (Array.isArray(p.compare.eternity) ? p.compare.eternity : [p.compare.eternity]) : []
            return (
              <div key={p.id} className={[styles.scene, p.pilot ? styles.scenePilot : ''].join(' ')} data-scene={p.id} data-on={sceneId === p.id}>
                {p.compare && (
                  <>
                    <Photo img={p.compare.infinity} className={styles.img} lazy={pi > 1} />
                    <div className={`${styles.wrap} ${styles.eter}`}>
                      {eter.map((v) => (
                        <Photo
                          key={v.src}
                          img={v}
                          className={`${styles.img} ${styles.ev}`}
                          lazy={pi > 1}
                          // a single Eternity photo is always on; with several, the 沙發 | 吧台 switch decides
                          on={'key' in v ? v.key === eterKey : true}
                        />
                      ))}
                    </div>
                  </>
                )}
                {p.views && (
                  <>
                    {p.views.map((v) => (
                      <Photo key={v.key} img={v} className={`${styles.img} ${styles.ev}`} lazy on={proKey === v.key} />
                    ))}
                    <div className={styles.chip} data-swap={swap}>
                      <span className={styles.chipK}>{shownView?.label}</span>
                      <span className={styles.chipT}>{shownView?.title}</span>
                    </div>
                  </>
                )}
                {p.pilot && <Photo img={p.pilot.image} className={styles.ipad} lazy />}
              </div>
            )
          })}

          <div className={styles.divider} aria-hidden="true">
            <div className={styles.handle}>
              <svg viewBox="0 0 22 14">
                <path d="M7 2 2 7l5 5M15 2l5 5-5 5" />
              </svg>
            </div>
          </div>
          <button type="button" data-rv-label="" className={`${styles.label} ${styles.labelL}`} aria-label={`${rooms.infinity.name} ${rooms.infinity.zh} ${rooms.infinity.label}`} onClick={() => { touchedRef.current = true; tween(100) }}>
            <b>{rooms.infinity.name}</b>
            <span>
              {rooms.infinity.zh}
              <i>{rooms.infinity.label}</i>
            </span>
          </button>
          <button type="button" data-rv-label="" className={`${styles.label} ${styles.labelR}`} aria-label={`${rooms.eternity.name} ${rooms.eternity.zh} ${rooms.eternity.label}`} onClick={() => { touchedRef.current = true; tween(0) }}>
            <b>{rooms.eternity.name}</b>
            <span>
              {rooms.eternity.zh}
              <i>{rooms.eternity.label}</i>
            </span>
          </button>
        </div>

        {/* ───── pills + panels ───── */}
        <div className={styles.side}>
          <div ref={rowRef} className={styles.pills} role="tablist" aria-label={data.title} onKeyDown={onTabKey}>
            {pills.map((p) => {
              const on = activeId === p.id
              return (
                <div key={p.id} className={styles.item} data-active={on}>
                  <button
                    type="button"
                    role="tab"
                    id={`${uid}-tab-${p.id}`}
                    data-tab={p.id}
                    aria-selected={on}
                    tabIndex={on ? 0 : -1}
                    className={styles.pill}
                    onClick={() => select(p.id)}
                  >
                    <span className={styles.ico} aria-hidden="true" />
                    <span>{p.name}</span>
                    {p.tag && <span className={styles.tag}>{p.tag}</span>}
                  </button>
                  <div className={styles.slot}>{renderPanel(p, 'desk')}</div>
                </div>
              )
            })}
          </div>
          <div className={styles.panelsMobile}>{renderPanel(activePill, 'mob')}</div>
        </div>
      </div>
    </section>
  )
}
