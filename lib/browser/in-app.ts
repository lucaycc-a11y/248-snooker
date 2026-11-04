// Detects in-app (embedded) browsers that cannot complete some payment redirects — e.g. the
// WeChat browser blocks AlipayHK's gateway ("copy the link and open it in a browser").
// UA sniffing is best-effort: a miss just means no notice is shown.

export type InAppBrowser = 'wechat' | 'qq' | 'weibo' | 'facebook' | 'instagram' | 'line' | 'tiktok' | 'webview'

export function detectInAppBrowser(ua: string): InAppBrowser | null {
  if (/MicroMessenger/i.test(ua)) return 'wechat'
  if (/\bQQ\//.test(ua) || /MQQBrowser.*\bV1_/.test(ua)) return 'qq'
  if (/Weibo/i.test(ua)) return 'weibo'
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/\bLine\//i.test(ua)) return 'line'
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'tiktok'
  // Generic embedded WebView of some other app: Android marks it `; wv)`; an iOS WebView has
  // no `Safari/` token (Safari, Chrome and Firefox on iOS all include it).
  if (/; wv\)/.test(ua)) return 'webview'
  if (/iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && /Mobile\//.test(ua) && !/Safari\//.test(ua)) return 'webview'
  return null
}
