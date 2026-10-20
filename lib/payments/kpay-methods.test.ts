import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { generateTestKeyPair } from './kpay-sign'
import {
  KPAY_METHODS,
  isKPayMethodId,
  kpaySelectionFor,
  kpayPaymentMethodFor,
} from './methods'
import { getKPayOrderType } from './types'

// ─────────────────────────────────────────────────────────────────
// Regression: the admin KPay branch only set kpayMethod for
// ["card","alipayhk","payme"]. Tapping octopus/fps/alipay/wechat/
// unionpay_qp moved the highlight but left kpayMethod on the previous
// rail, so KPay received the wrong method — production logs showed
// PayMe orders after tapping Octopus. The `kpayMethod ?? "fps"` fallback
// then hid the mismatch entirely.
//
// These tests drive the same two functions the component now uses
// (kpaySelectionFor → state, kpayPaymentMethodFor → the method prop and
// the Stage 2 gate) and then assert against the real KPayProvider that
// the chosen rail maps to the right endpoint.
// ─────────────────────────────────────────────────────────────────

/** What KPayPayment would POST to the admin route as `body.method`. */
type ClientRequest = { method: string | null; mode: 'qr' | 'h5' | null }

/**
 * Mirror of the admin KPay wiring in app/[locale]/book/page.tsx (Screen3):
 * onSelect stores the selection, Stage 2 renders KPayPayment only when
 * kpayPaymentMethodFor returns a method.
 */
function createAdminKpaySession() {
  let paymentMethod: string | null = null
  let kpayMethod: string | null = null
  let kpayMode: 'qr' | 'h5' = 'qr'

  return {
    /** PaymentMethodList onSelect */
    select(method: string, isDesktop = true): void {
      paymentMethod = method
      const selection = kpaySelectionFor(method, isDesktop)
      if (selection) {
        kpayMethod = selection.method
        kpayMode = selection.mode
      } else {
        kpayMethod = null
      }
    },
    /** Stage 2 gate: null → error branch, KPayPayment is not mounted. */
    stage2Gate(): string | null {
      return kpayPaymentMethodFor(paymentMethod, kpayMethod)
    },
    /** The `method` prop passed to KPayPayment (= body.method to the route). */
    clientRequest(): ClientRequest {
      const sent = kpayPaymentMethodFor(paymentMethod, kpayMethod)
      return { method: sent, mode: sent === null ? null : kpayMode }
    },
  }
}

function shuffled<T>(items: readonly T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Strip PEM armor, leaving the base64 DER body that toPem() expects. */
function derBody(pem: string): string {
  return pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
}

describe('admin KPay method selection', () => {
  it('the shared list is exactly the 8 KPay rails', () => {
    expect([...KPAY_METHODS]).toEqual([
      'card',
      'fps',
      'payme',
      'octopus',
      'alipay',
      'alipayhk',
      'wechat',
      'unionpay_qp',
    ])
  })

  it('KPayPayment receives exactly the method tapped, for all 8 rails in random order', () => {
    for (let trial = 0; trial < 12; trial++) {
      const session = createAdminKpaySession()
      const order = shuffled(KPAY_METHODS)

      for (const tap of order) {
        session.select(tap)
        const req = session.clientRequest()

        // The method prop — and therefore body.method — must equal the tap.
        expect(req.method).toBe(tap)
        // Stage 2 must render (not the error branch).
        expect(session.stage2Gate()).toBe(tap)
        // Desktop gets a QR, mobile gets H5.
        expect(req.mode).toBe('qr')
      }
    }
  })

  it('switching mobile/desktop only changes mode, never the method', () => {
    const session = createAdminKpaySession()
    session.select('octopus', true)
    expect(session.clientRequest()).toEqual({ method: 'octopus', mode: 'qr' })
    session.select('octopus', false)
    expect(session.clientRequest()).toEqual({ method: 'octopus', mode: 'h5' })
  })

  it('octopus after payme sends method=octopus, not the previous payme', () => {
    const session = createAdminKpaySession()

    session.select('payme')
    expect(session.clientRequest().method).toBe('payme')

    // The production repro: tap Octopus while the previous rail was PayMe.
    session.select('octopus')
    expect(session.clientRequest().method).toBe('octopus')
    expect(session.stage2Gate()).toBe('octopus')
  })

  it('every one of the 8 rails survives being selected after every other rail', () => {
    for (const first of KPAY_METHODS) {
      for (const second of KPAY_METHODS) {
        const session = createAdminKpaySession()
        session.select(first)
        session.select(second)
        expect(session.clientRequest().method).toBe(second)
      }
    }
  })

  it('a non-KPay id clears the method and blocks Stage 2 instead of substituting fps', () => {
    const session = createAdminKpaySession()
    session.select('payme')
    expect(session.clientRequest().method).toBe('payme')

    // e.g. google_pay / apple_pay / wechat_pay — not KPay rails.
    session.select('google_pay')
    // Before this fix: kpayMethod stayed "payme", then `?? "fps"` would have
    // sent payme (or fps) for a rail that cannot be started. Now it is null.
    expect(session.stage2Gate()).toBeNull()
    expect(session.clientRequest().method).toBeNull()
  })

  it('stale state that disagrees with the selection is rejected, never sent', () => {
    // paymentMethod=octopus but kpayMethod still says payme (the old bug).
    expect(kpayPaymentMethodFor('octopus', 'payme')).toBeNull()
    expect(kpayPaymentMethodFor('octopus', 'octopus')).toBe('octopus')
    expect(kpayPaymentMethodFor('octopus', null)).toBeNull()
    expect(kpayPaymentMethodFor(null, 'octopus')).toBeNull()
  })

  it('isKPayMethodId accepts only the 8 rails', () => {
    for (const m of KPAY_METHODS) expect(isKPayMethodId(m)).toBe(true)
    for (const m of ['google_pay', 'apple_pay', 'wechat_pay', '', 'fpsx']) {
      expect(isKPayMethodId(m)).toBe(false)
    }
    expect(isKPayMethodId(null)).toBe(false)
    expect(isKPayMethodId(undefined)).toBe(false)
  })
})

describe('KPay endpoint for the selected rail', () => {
  type FetchCall = { path: string; body: Record<string, unknown> }
  const fetchCalls: FetchCall[] = []

  beforeAll(() => {
    const { privateKey, publicKey } = generateTestKeyPair()
    process.env.KPAY_MERCHANT_CODE = 'TEST-MERCHANT'
    process.env.KPAY_PRIVATE_KEY = derBody(privateKey)
    process.env.KPAY_PLATFORM_PUBLIC_KEY = derBody(publicKey)
  })

  beforeEach(() => {
    fetchCalls.length = 0
    vi.resetModules()
    vi.doMock('@/lib/kpay/proxyFetch', () => ({
      kpayProxyFetch: vi.fn(async (url: string, init?: { body?: string }) => {
        const raw = typeof init?.body === 'string' ? init.body : '{}'
        fetchCalls.push({ path: new URL(url).pathname, body: JSON.parse(raw) as Record<string, unknown> })
        return new Response(
          JSON.stringify({
            code: 10000,
            message: 'ok',
            data: { orderNo: 'TEST-ORDER-1', payInfo: 'qr-payload' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )
      }),
    }))
  })

  afterEach(() => {
    vi.doUnmock('@/lib/kpay/proxyFetch')
    vi.restoreAllMocks()
  })

  it('octopus after payme posts to /v1/qr/sales/scan/octopus and logs that endpoint', async () => {
    const logs: string[] = []
    const logSpy = vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(' '))
    })

    // The method the admin UI now sends for an Octopus tap after PayMe.
    const session = createAdminKpaySession()
    session.select('payme')
    session.select('octopus')
    const bodyMethod = session.clientRequest().method
    expect(bodyMethod).toBe('octopus')

    const { KPayProvider } = await import('./kpay')
    const provider = new KPayProvider(undefined, 'uat')
    await provider.createOrder({
      outTradeNo: 'T-1',
      bookingId: 'B-1',
      amount: 100,
      // Exactly what the client sends as body.method — the KPay route accepts
      // these 8 and rejects everything else.
      method: bodyMethod as 'octopus',
      mode: 'qr',
      baseUrl: 'https://example.test',
    })

    // Request body carries the rail via orderType; the route sees body.method.
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].body.orderType).toBe('OCTOPUS_SALE_QR')
    expect(getKPayOrderType('octopus', 'qr')).toBe('OCTOPUS_SALE_QR')

    // The endpoint actually posted to.
    expect(fetchCalls[0].path).toBe('/v1/qr/sales/scan/octopus')

    // The route log line — [KPay] createOrder: ... | method: X | endpoint: Y
    const createLog = logs.find((l) => l.includes('[KPay] createOrder:'))
    expect(createLog).toBeDefined()
    expect(createLog).toContain('method: octopus')
    expect(createLog).toContain('endpoint: /v1/qr/sales/scan/octopus')

    logSpy.mockRestore()
  })

  it('every rail posts to its own endpoint — none silently falls back to fps', async () => {
    // Drive the real createOrder for all 8 rails and record where each lands.
    // getQrEndpoint is private, so we assert the observable URL instead of
    // restating its table. A missing map entry falls through to
    // '/v1/qr/sales/h5/fps' — the same silent-substitution bug class — so
    // every non-card rail must be pinned to a distinct endpoint.
    const expectedQr: Record<string, string> = {
      fps: '/v1/qr/sales/scan/fps',
      payme: '/v1/qr/sales/scan/payme',
      octopus: '/v1/qr/sales/scan/octopus',
      alipay: '/v1/qr/sales/scan/alipay',
      alipayhk: '/v1/qr/sales/scan/alipay',
      wechat: '/v1/qr/sales/scan/wxpay',
      unionpay_qp: '/v1/qr/sales/scan/unionpay',
    }

    const { KPayProvider } = await import('./kpay')
    const provider = new KPayProvider(undefined, 'uat')

    for (const rail of KPAY_METHODS) {
      fetchCalls.length = 0
      await provider.createOrder({
        outTradeNo: `T-${rail}`,
        bookingId: 'B-1',
        amount: 100,
        method: rail,
        mode: 'qr',
        baseUrl: 'https://example.test',
      })

      expect(fetchCalls).toHaveLength(1)
      const path = fetchCalls[0].path

      if (rail === 'card') {
        // Card is the CNP hosted flow — KPay's own PCI page, not a QR scan.
        expect(path).toBe('/v1/order/add')
        expect(fetchCalls[0].body.orderType).toBe('CNP_SALES_GATEWAY')
        continue
      }

      expect(path, `rail ${rail} must not fall back to fps`).toBe(expectedQr[rail])
      // The map's default when a rail is missing — the silent-substitution bug.
      expect(path).not.toBe('/v1/qr/sales/h5/fps')
      // orderType is the method identifier KPay receives in the request body.
      expect(fetchCalls[0].body.orderType).toBe(getKPayOrderType(rail, 'qr'))
    }

    // The production repro endpoint, pinned explicitly.
    expect(expectedQr.octopus).toBe('/v1/qr/sales/scan/octopus')
  })
})
