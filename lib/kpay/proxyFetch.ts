const KPAY_REQUEST_TIMEOUT_MS = 10_000

export async function kpayProxyFetch(
  targetUrl: string,
  options: RequestInit = {},
): Promise<Response> {
  const proxyBase = process.env.KPAY_PROXY_URL
  const proxyAuth = process.env.KPAY_PROXY_AUTH_TOKEN

  if (!proxyBase || !proxyAuth) {
    throw new Error('KPAY_PROXY_URL or KPAY_PROXY_AUTH_TOKEN not configured')
  }

  const controller = new AbortController()
  const callerSignal = options.signal
  let didTimeout = false
  const abortForCaller = () => controller.abort()
  const timeout = setTimeout(() => {
    if (callerSignal?.aborted) return
    didTimeout = true
    controller.abort()
  }, KPAY_REQUEST_TIMEOUT_MS)

  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort()
    } else {
      callerSignal.addEventListener('abort', abortForCaller, { once: true })
    }
  }

  try {
    return await fetch(proxyBase, {
      ...options,
      signal: controller.signal,
      headers: {
        ...options.headers,
        'X-Target-Url': targetUrl,
        'X-Proxy-Auth': proxyAuth,
      },
    })
  } catch (error) {
    if (didTimeout) throw new Error('KPay API request timeout')
    throw error
  } finally {
    clearTimeout(timeout)
    callerSignal?.removeEventListener('abort', abortForCaller)
  }
}
