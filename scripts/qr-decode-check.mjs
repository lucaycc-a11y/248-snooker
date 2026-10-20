// QR decode harness for components/checkout/KPayPayment.tsx.
//
// Renders the EXACT props the component feeds QRCodeSVG and decodes the result
// with jsQR, so the keep-the-logo / drop-the-logo decision is evidence-based
// rather than a guess. Not shipped — scratch verification only.
//
// Component props under test (post-fix):
//   <QRCodeSVG value={payInfo} size={240} bgColor="#ffffff" fgColor="#000000"
//              level={logo ? 'Q' : 'M'} includeMargin
//              imageSettings={{ src, width: LOGO, height: LOGO, excavate: true }} />
// includeMargin in qrcode.react v4 == marginSize 4 (a 4-module quiet zone).
//
// qrcode renders the same geometry: full width == `size`, `margin` in modules,
// dark/light module colours, same error-correction levels.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIZE = 240 // >= 220 per spec; matches styles.qr 240x240 box
const QUIET_ZONE_MODULES = 4 // == includeMargin
const LOGO_PX = 26 // <= 12% of 240 (28.8); 26 = 10.8%

// Realistic gateway payloads. PayMe payloads are short-ish FPS-style strings;
// AlipayHK CNP payloads run much longer and are the density stress case.
const PAYLOADS = {
  'payme-150':
    '00020101021226350012hk.com.hkicl0110PAYME0TEST0208123456785204000053033445802HK5908SPACE8HK6002HK620705030016304A1B2',
  'alipayhk-320':
    '00020101021226620012hk.com.alipay0110ALIPAYHK010208208812340208208856785204581253033445802HK5912SPACE8 SNOOKER6002HK62100306000000040400006304ABCD' +
    'X'.repeat(180),
}

function decodePng(buf) {
  return PNG.sync.read(buf)
}

/** Composite the payment logo the way qrcode.react's excavate does: a plain
 *  square punched out of the modules, then the image drawn into it. */
function compositeLogo(png, logoPath, logoPx) {
  const logo = decodePng(readFileSync(logoPath))
  const x0 = Math.floor((png.width - logoPx) / 2)
  const y0 = Math.floor((png.height - logoPx) / 2)

  // excavate: white square, so the logo sits on a clean field
  for (let y = y0; y < y0 + logoPx; y++) {
    for (let x = x0; x < x0 + logoPx; x++) {
      const i = (png.width * y + x) << 2
      png.data[i] = 255
      png.data[i + 1] = 255
      png.data[i + 2] = 255
      png.data[i + 3] = 255
    }
  }

  // nearest-neighbour scale of the logo into the hole
  for (let y = 0; y < logoPx; y++) {
    for (let x = 0; x < logoPx; x++) {
      const sx = Math.floor((x / logoPx) * logo.width)
      const sy = Math.floor((y / logoPx) * logo.height)
      const si = (logo.width * sy + sx) << 2
      const di = (png.width * (y0 + y) + (x0 + x)) << 2
      const a = logo.data[si + 3] / 255
      if (a < 0.1) continue
      png.data[di] = Math.round(logo.data[si] * a + 255 * (1 - a))
      png.data[di + 1] = Math.round(logo.data[si + 1] * a + 255 * (1 - a))
      png.data[di + 2] = Math.round(logo.data[si + 2] * a + 255 * (1 - a))
      png.data[di + 3] = 255
    }
  }
  return png
}

async function renderCase({ value, level, logoPath }) {
  const buf = await QRCode.toBuffer(value, {
    type: 'png',
    width: SIZE,
    margin: QUIET_ZONE_MODULES,
    errorCorrectionLevel: level,
    color: { dark: '#000000', light: '#ffffff' },
  })
  let png = decodePng(buf)
  if (logoPath) png = compositeLogo(png, logoPath, LOGO_PX)

  const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
    inversionAttempts: 'dontInvert', // modules are dark-on-white after the fix
  })
  return {
    ok: res?.data === value,
    decodedMatches: res ? res.data === value : false,
    found: Boolean(res),
    length: value.length,
  }
}

const CASES = [
  // A. the CURRENT buggy render: inverted, level L, 32px logo (14.5%)
  ...Object.entries(PAYLOADS).map(([name, value]) => ({
    label: `CURRENT inverted L +32px logo | ${name}`,
    value,
    level: 'L',
    inverted: true,
    logoPath: join(ROOT, 'public/icons/payment/payme.png'),
    logoPx: 32,
  })),
  // B. proposed: dark-on-white, level Q, 26px logo (10.8%)
  ...Object.entries(PAYLOADS).flatMap(([name, value]) =>
    ['payme', 'alipayhk'].map((m) => ({
      label: `PROPOSED Q +${LOGO_PX}px logo | ${name} | ${m}`,
      value,
      level: 'Q',
      logoPath: join(ROOT, `public/icons/payment/${m}.png`),
    })),
  ),
  // C. fallback if B fails: dark-on-white, level M, no logo
  ...Object.entries(PAYLOADS).map(([name, value]) => ({
    label: `FALLBACK M no logo | ${name}`,
    value,
    level: 'M',
    logoPath: null,
  })),
]

// The inverted case needs an inverted render to reproduce today's bug faithfully.
async function renderInverted(value, level, logoPath, logoPx) {
  const buf = await QRCode.toBuffer(value, {
    type: 'png',
    width: SIZE,
    margin: QUIET_ZONE_MODULES,
    errorCorrectionLevel: level,
    color: { dark: '#ffffff', light: '#000000' }, // today's BG/FG
  })
  let png = decodePng(buf)
  if (logoPath) {
    // today: excavate paints the *QR bg* colour through; on the inverted tile
    // that is black, with the logo drawn on top.
    const x0 = Math.floor((png.width - logoPx) / 2)
    const y0 = Math.floor((png.height - logoPx) / 2)
    for (let y = y0; y < y0 + logoPx; y++) {
      for (let x = x0; x < x0 + logoPx; x++) {
        const i = (png.width * y + x) << 2
        png.data[i] = 0
        png.data[i + 1] = 0
        png.data[i + 2] = 0
      }
    }
  }
  return png
}

console.log('payload lengths:', Object.fromEntries(Object.entries(PAYLOADS).map(([k, v]) => [k, v.length])))
console.log(`size=${SIZE}px  quietZone=${QUIET_ZONE_MODULES} modules  logo=${LOGO_PX}px (${((LOGO_PX / SIZE) * 100).toFixed(1)}%)\n`)

for (const c of CASES) {
  let result
  if (c.inverted) {
    const png = await renderInverted(c.value, c.level, c.logoPath, c.logoPx ?? 32)
    // Payment-app scanners look for dark-on-white. jsQR with dontInvert on an
    // inverted code is the honest analogue of "a scanner cannot read it".
    const res = jsQR(new Uint8ClampedArray(png.data), png.width, png.height, {
      inversionAttempts: 'dontInvert',
    })
    result = { found: Boolean(res), decodedMatches: res ? res.data === c.value : false }
  } else {
    result = await renderCase(c)
  }
  const status = result.decodedMatches ? 'PASS' : result.found ? 'MISMATCH' : 'FAIL'
  console.log(`${status.padEnd(8)} ${c.label}`)
}
