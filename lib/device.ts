/**
 * Simple mobile device detection based on User-Agent.
 * Used to determine WeChat Pay flow: H5 (mobile) vs QR (desktop).
 */
export function isMobileDevice(userAgent: string): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
}

/**
 * Client-side mobile detection using window.navigator.
 */
export function isMobileClient(): boolean {
  if (typeof window === 'undefined') return false
  return isMobileDevice(window.navigator.userAgent)
}
