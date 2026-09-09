export async function kpayProxyFetch(
  targetUrl: string,
  options: RequestInit = {},
): Promise<Response> {
  const proxyBase = process.env.KPAY_PROXY_URL
  const proxyAuth = process.env.KPAY_PROXY_AUTH_TOKEN

  if (!proxyBase || !proxyAuth) {
    throw new Error('KPAY_PROXY_URL or KPAY_PROXY_AUTH_TOKEN not configured')
  }

  return fetch(proxyBase, {
    ...options,
    headers: {
      ...options.headers,
      'X-Target-Url': targetUrl,
      'X-Proxy-Auth': proxyAuth,
    },
  })
}
