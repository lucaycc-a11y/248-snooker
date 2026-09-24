/**
 * Validates redirect URLs to prevent open redirect vulnerabilities.
 * Only allows same-origin redirects or explicitly allowed domains.
 *
 * This is a pure utility function safe for both client and server use.
 */
export function validateRedirectUrl(url: string, allowedOrigins: string[] = []): string {
  // Reject empty strings
  if (!url || typeof url !== 'string') {
    return '/'
  }

  // Reject protocol-relative URLs (//evil.com)
  if (url.startsWith('//')) {
    return '/'
  }

  // Reject dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:']
  const lowerUrl = url.toLowerCase()
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return '/'
    }
  }

  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'https://space8.com.hk')

    // Reject non-HTTP(S) protocols after parsing
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '/'
    }

    // Allow relative URLs (same origin)
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://space8.com.hk'
    const baseHostname = new URL(baseOrigin).hostname

    if (!parsed.hostname || parsed.hostname === baseHostname) {
      return parsed.pathname + parsed.search + parsed.hash
    }

    // Check against allowed origins
    const origin = `${parsed.protocol}//${parsed.hostname}`
    if (allowedOrigins.includes(origin)) {
      return url
    }

    // Reject external URLs
    return '/'
  } catch {
    // Invalid URL - return safe default
    return '/'
  }
}
