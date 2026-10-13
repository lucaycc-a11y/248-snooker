/**
 * buildOrderShareImage — draws ONE image for the whole order: all rooms as text lines,
 * one total, one QR (member code) and the member code text.
 * Good Times for English words, numbers and codes; system CJK font for Chinese.
 * Renders at 2x for sharp text on high-DPI screens.
 */

export async function buildOrderShareImage(
  o: {
    dateLabel: string
    lines: Array<{ time: string; room: string }>
    totalPrice: number
    memberCode: string
    paidLabel: string
    hint: string
  },
  toDataURL: (text: string, opts: any) => Promise<string>
): Promise<Blob> {
  const FONT_GT = "'Good Times', 'JetBrains Mono', monospace"
  const FONT_CJK = "system-ui, -apple-system, 'PingFang HK', 'Noto Sans TC', 'Microsoft JhengHei', sans-serif"

  // Wait for Good Times font to load
  await Promise.all([
    document.fonts.load("600 20px 'Good Times'"),
    document.fonts.ready,
  ])

  const S = 2 // 2x scale for sharp rendering
  const W = 560
  const PAD = 40
  const LINE_H = 40
  const QR = 200

  // layout flow: logo 46 → date +40 → first line +36 → lines → tear +4 → total +36 → QR +36 → code +26 → hint → bottom padding
  const H = 46 + 40 + 36 + o.lines.length * LINE_H + 4 + 36 + 36 + QR + 36 + 26 + 44

  const c = document.createElement("canvas")
  c.width = W * S
  c.height = H * S

  const ctx = c.getContext("2d")
  if (!ctx) throw new Error("canvas 2d unavailable")

  ctx.scale(S, S)

  // Dark background
  ctx.fillStyle = "#0a0a0a"
  ctx.fillRect(0, 0, W, H)

  // Border
  ctx.strokeStyle = "rgba(255,255,255,0.12)"
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)

  // Helper: draw mixed-font parts centered on one baseline
  const centerMixed = (
    parts: Array<{ text: string; font: string; color: string; w?: number }>,
    y: number
  ) => {
    ctx.textBaseline = "middle"
    ctx.textAlign = "left"
    let total = 0
    for (const p of parts) {
      ctx.font = p.font
      p.w = ctx.measureText(p.text).width
      total += p.w
    }
    let x = (W - total) / 2
    for (const p of parts) {
      ctx.font = p.font
      ctx.fillStyle = p.color
      ctx.fillText(p.text, x, y)
      x += p.w ?? 0
    }
  }

  let y = 46

  // SPACE8 logo
  centerMixed([{ text: "SPACE8", font: `400 22px ${FONT_GT}`, color: "#25D366" }], y)

  y += 40

  // Date label
  centerMixed([{ text: o.dateLabel, font: `500 15px ${FONT_CJK}`, color: "rgba(255,255,255,0.7)" }], y)

  y += 36

  // Room lines
  for (const l of o.lines) {
    centerMixed(
      [
        { text: l.time, font: `400 17px ${FONT_GT}`, color: "#ffffff" },
        { text: `  ${l.room}`, font: `500 16px ${FONT_CJK}`, color: "#ffffff" },
      ],
      y
    )
    y += LINE_H
  }

  y += 4

  // Dashed tear line
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = "rgba(255,255,255,0.2)"
  ctx.beginPath()
  ctx.moveTo(PAD, y)
  ctx.lineTo(W - PAD, y)
  ctx.stroke()
  ctx.setLineDash([])

  y += 36

  // Total price
  centerMixed(
    [
      { text: `${o.paidLabel}  `, font: `500 15px ${FONT_CJK}`, color: "rgba(255,255,255,0.6)" },
      {
        text: `HK$${o.totalPrice.toLocaleString("en-HK")}`,
        font: `400 26px ${FONT_GT}`,
        color: "#25D366",
      },
    ],
    y
  )

  y += 36

  // QR code
  const qrUrl = await toDataURL(o.memberCode, {
    margin: 2,
    width: QR * S,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  })

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image()
    i.onload = () => res(i)
    i.onerror = () => rej(new Error("qr image load failed"))
    i.src = qrUrl
  })

  // White rounded background for QR
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.roundRect((W - QR) / 2 - 8, y - 8, QR + 16, QR + 16, 14)
  ctx.fill()

  ctx.drawImage(img, (W - QR) / 2, y, QR, QR)

  y += QR + 36

  // Member code text
  centerMixed([{ text: o.memberCode, font: `400 16px ${FONT_GT}`, color: "rgba(255,255,255,0.9)" }], y)

  y += 26

  // Hint text
  centerMixed([{ text: o.hint, font: `400 12px ${FONT_CJK}`, color: "rgba(255,255,255,0.45)" }], y)

  // Convert canvas to PNG blob
  return new Promise<Blob>((res, rej) => {
    c.toBlob((b) => {
      if (b) res(b)
      else rej(new Error("toBlob failed"))
    }, "image/png")
  })
}
