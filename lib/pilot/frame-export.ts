import QRCode from 'qrcode'

// Draws a Space Pilot Photo Booth frame around a clip and records the result in the viewer's own browser.
// Nothing is stored on the server: the framed file only exists on the phone that exports it (saves Storage).

export type FrameKind = 'winner45' | 'story916'

export type FrameInfo = {
  label: string
  room: string
  scoreA: number | null
  scoreB: number | null
  players: string[]
  dateIso: string
  qrUrl: string
}

const FONT = "'Good Times', 'Noto Sans TC', system-ui, sans-serif"

const SIZES: Record<FrameKind, { w: number; h: number }> = {
  winner45: { w: 1080, h: 1350 },
  story916: { w: 1080, h: 1920 },
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

function pickMime(): string {
  for (const m of ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) return m
  }
  return ''
}

export function frameFileExt(blob: Blob): string {
  return blob.type.includes('mp4') ? 'mp4' : 'webm'
}

export async function exportFramed(videoUrl: string, kind: FrameKind, info: FrameInfo): Promise<Blob | null> {
  if (typeof MediaRecorder === 'undefined') return null
  const { w, h } = SIZES[kind]
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const qr = await loadImage(await QRCode.toDataURL(info.qrUrl, { margin: 1, width: 240 }))
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.src = videoUrl
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve()
    video.onerror = () => reject(new Error('video'))
  })

  const winner = kind === 'winner45'
  const pad = 56
  const boxX = pad
  const boxY = 150
  const boxW = w - pad * 2
  const bottom = winner ? 330 : 380
  const boxH = h - boxY - bottom
  const date = new Date(info.dateIso)
  const dateText = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('zh-HK', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' })
  const hasScore = info.scoreA !== null && info.scoreB !== null

  const draw = () => {
    const bg = ctx.createLinearGradient(0, 0, w, h)
    bg.addColorStop(0, '#05070C')
    bg.addColorStop(1, winner ? '#241a6e' : '#173a0c')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)

    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = `700 46px ${FONT}`
    ctx.fillText('SPACE8', pad, 100)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `600 28px ${FONT}`
    ctx.fillText('SPACE PILOT', w - pad, 98)

    ctx.save()
    roundRect(ctx, boxX, boxY, boxW, boxH, 44)
    ctx.clip()
    ctx.fillStyle = '#000'
    ctx.fillRect(boxX, boxY, boxW, boxH)
    const vw = video.videoWidth || 16
    const vh = video.videoHeight || 9
    const scale = Math.max(boxW / vw, boxH / vh)
    const dw = vw * scale
    const dh = vh * scale
    ctx.drawImage(video, boxX + (boxW - dw) / 2, boxY + (boxH - dh) / 2, dw, dh)
    ctx.restore()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 3
    roundRect(ctx, boxX, boxY, boxW, boxH, 44)
    ctx.stroke()

    const y0 = boxY + boxH + 28
    ctx.textAlign = 'left'
    ctx.fillStyle = '#fff'
    ctx.font = `700 54px ${FONT}`
    ctx.fillText(info.label.slice(0, 18), pad, y0 + 60)
    if (hasScore) {
      ctx.textAlign = 'right'
      ctx.font = `700 88px ${FONT}`
      ctx.fillText(`${info.scoreA} : ${info.scoreB}`, w - pad - 280, y0 + 70)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.font = `500 32px ${FONT}`
    ctx.fillText(info.players.join('  vs  ').slice(0, 34), pad, y0 + 130)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = `500 28px ${FONT}`
    ctx.fillText(`${info.room}${info.room ? ' · ' : ''}${dateText}`, pad, y0 + 178)

    ctx.fillStyle = '#fff'
    roundRect(ctx, w - pad - 220, y0 + 10, 220, 220, 20)
    ctx.fill()
    ctx.drawImage(qr, w - pad - 208, y0 + 22, 196, 196)
    ctx.textAlign = 'right'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = `500 22px ${FONT}`
    ctx.fillText('掃碼儲存 · 24 小時內有效', w - pad, y0 + 262)
  }

  const mime = pickMime()
  const stream = canvas.captureStream(30)
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 3_000_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
  const done = new Promise<Blob>((resolve) => {
    rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }))
  })

  let running = true
  const loop = () => {
    if (!running) return
    draw()
    requestAnimationFrame(loop)
  }
  video.onended = () => { running = false; draw(); rec.stop() }
  rec.start(500)
  await video.play()
  loop()
  return done
}
