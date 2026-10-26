// Confirm-page-first gateway handoff.
//
// The payment page never sends the customer to the gateway (Alipay / PayMe / card)
// directly. It stashes the gateway instructions here, navigates to /book/confirm, and
// the confirm page performs the gateway redirect. The history entry the customer comes
// back to (browser Back, or the gateway's return link) is therefore the confirm page,
// which only reads the payment state. It can never show the method picker again, so a
// returning customer is never invited to pay a second time.

export type GatewayHandoff = {
  bookingId: string
  kind: 'redirect' | 'form-post'
  payInfo: string
  savedAt: number
}

const HANDOFF_KEY = 'kpayGatewayHandoff'
const MAX_AGE_MS = 2 * 60 * 1000

export function stashGatewayHandoff(handoff: Omit<GatewayHandoff, 'savedAt'>): boolean {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...handoff, savedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}

// Reads and ALWAYS removes the stash, so a refresh or a Back navigation can never
// replay the redirect.
export function takeGatewayHandoff(bookingId: string): GatewayHandoff | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY)
    if (!raw) return null
    sessionStorage.removeItem(HANDOFF_KEY)
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const r = parsed as Record<string, unknown>
    if (
      r.bookingId !== bookingId ||
      (r.kind !== 'redirect' && r.kind !== 'form-post') ||
      typeof r.payInfo !== 'string' ||
      typeof r.savedAt !== 'number' ||
      Date.now() - r.savedAt > MAX_AGE_MS
    ) {
      return null
    }
    return { bookingId, kind: r.kind, payInfo: r.payInfo, savedAt: r.savedAt }
  } catch {
    return null
  }
}

export async function fetchFreezeActive(): Promise<boolean> {
  try {
    const res = await fetch('/api/checkout/freeze-flag', { cache: 'no-store' })
    const json: unknown = await res.json().catch(() => null)
    return !!json && typeof json === 'object' && (json as Record<string, unknown>).active === true
  } catch {
    return false
  }
}

/**
 * Submit a JSON parameter map to a payment gateway as an HTML form submit (Alipay H5).
 * The target URL and method are carried INSIDE the JSON (`action` / `method`).
 * Returns false when payInfo cannot be parsed or has no usable https action.
 */
export function submitGatewayForm(payInfo: string): boolean {
  let fields: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(payInfo)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return false
    fields = parsed as Record<string, unknown>
  } catch {
    return false
  }

  const action = fields.action
  if (typeof action !== 'string' || !/^https:\/\//i.test(action)) return false

  const form = document.createElement('form')
  form.method = typeof fields.method === 'string' && fields.method.toUpperCase() === 'GET' ? 'GET' : 'POST'
  form.action = action
  form.style.display = 'none'

  let fieldCount = 0
  for (const [key, value] of Object.entries(fields)) {
    if (key === 'action' || key === 'method') continue
    if (value === null || value === undefined) continue
    if (typeof value === 'object') continue
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = key
    input.value = String(value)
    form.appendChild(input)
    fieldCount++
  }
  if (fieldCount === 0) return false

  document.body.appendChild(form)
  form.submit()
  return true
}
