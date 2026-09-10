import { afterEach, describe, expect, it, vi } from 'vitest'

import { kpayProxyFetch } from './proxyFetch'

const originalFetch = global.fetch
const originalProxyUrl = process.env.KPAY_PROXY_URL
const originalProxyToken = process.env.KPAY_PROXY_AUTH_TOKEN

afterEach(() => {
  global.fetch = originalFetch
  process.env.KPAY_PROXY_URL = originalProxyUrl
  process.env.KPAY_PROXY_AUTH_TOKEN = originalProxyToken
  vi.useRealTimers()
})

describe('kpayProxyFetch', () => {
  it('throws a clear error after ten seconds when the proxy does not respond', async () => {
    process.env.KPAY_PROXY_URL = 'https://proxy.example.test'
    process.env.KPAY_PROXY_AUTH_TOKEN = 'test-token'
    vi.useFakeTimers()

    global.fetch = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })) as typeof fetch

    const request = kpayProxyFetch('https://kpay.example.test/order')
    const assertion = expect(request).rejects.toThrow('KPay API request timeout')
    await vi.advanceTimersByTimeAsync(10_000)

    await assertion
  })

  it('preserves a caller-initiated abort instead of reporting a timeout', async () => {
    process.env.KPAY_PROXY_URL = 'https://proxy.example.test'
    process.env.KPAY_PROXY_AUTH_TOKEN = 'test-token'

    const controller = new AbortController()
    global.fetch = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'))
      })
    })) as typeof fetch

    const request = kpayProxyFetch('https://kpay.example.test/order', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
  })
})
