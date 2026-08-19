import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServiceSupabase } from '@/lib/supabase/service'
import { getPaymentProvider, getPaymentMethodSettings } from '@/lib/payments'
import { resolvePilotSession } from '@/lib/pilot/session'
import { logSiteError } from '@/lib/errors/log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = { booking_id?: unknown; session_id?: unknown; payment_method?: unknown }

// POST /api/pilot/create-renewal-order  { booking_id, session_id, payment_method }
// Requires Authorization: Bearer {session_token}
// Server-side: re-derives amount, checks availability and enabled method, inserts pending order,
// calls KPay createOrder, stamps provider_order_no, returns QR/H5 payload.
export async function POST(request: Request) {
  const pilotSession = await resolvePilotSession(request.headers.get('authorization'))
  if (!pilotSession) return NextResponse.json({ error: 'invalid_session' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as Body | null
  const bookingId = typeof body?.booking_id === 'string' ? body.booking_id : ''
  const sessionId = typeof body?.session_id === 'string' ? body.session_id : null
  const paymentMethod = typeof body?.payment_method === 'string' ? body.payment_method : ''

  if (!bookingId) return NextResponse.json({ error: 'missing booking_id' }, { status: 400 })
  if (!paymentMethod) return NextResponse.json({ error: 'missing payment_method' }, { status: 400 })

  // Validate method is enabled — never trust the client.
  const settings = await getPaymentMethodSettings(paymentMethod)
  if (!settings || !settings.enabled) {
    return NextResponse.json({ error: 'payment_method_unavailable' }, { status: 400 })
  }

  const service = getServiceSupabase()

  // Re-derive availability and amount server-side (never trust a client-sent amount).
  const { data: rpc, error: rpcErr } = await service.rpc('check_renewal_availability', {
    p_booking_id: bookingId,
  })
  if (rpcErr) {
    if (rpcErr.message?.includes('BOOKING_NOT_FOUND')) {
      return NextResponse.json({ error: 'booking_not_found' }, { status: 404 })
    }
    console.error('[pilot/create-renewal-order] availability check failed', rpcErr)
    await logSiteError('pilot/create-renewal-order', 'error', 'availability rpc failed', {
      message: rpcErr.message,
      bookingId,
    })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  const avail = rpc as { available: boolean; amount: number; period: string; next_booking_start: string | null }
  if (!avail.available) {
    return NextResponse.json(
      { error: '下一位已預約，無法續約', next_booking_start: avail.next_booking_start },
      { status: 409 },
    )
  }

  const amount = avail.amount
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'zero_amount' }, { status: 400 })
  }

  // Check for an existing pending renewal order (idempotent re-create guard).
  const { data: existingOrder } = await service
    .from('renewal_orders')
    .select('id, provider_order_no, expires_at, status')
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
    .maybeSingle()

  if (existingOrder?.provider_order_no) {
    // Return the existing order rather than creating a duplicate.
    return NextResponse.json({
      renewal_order_id: existingOrder.id,
      amount,
      qr_payload: existingOrder.provider_order_no,
      expires_at: existingOrder.expires_at,
      existing: true,
    })
  }

  // Insert the renewal order.
  const renewalId = randomUUID()
  const { error: insertErr } = await service.from('renewal_orders').insert({
    id: renewalId,
    booking_id: bookingId,
    session_id: sessionId ?? null,
    extend_minutes: 60,
    amount,
    payment_method: paymentMethod,
    status: 'pending',
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  })
  if (insertErr) {
    if ((insertErr as { code?: string }).code === '23505') {
      // Another request already created a pending order for this booking.
      return NextResponse.json({ error: 'renewal_already_pending' }, { status: 409 })
    }
    console.error('[pilot/create-renewal-order] insert failed', insertErr)
    await logSiteError('pilot/create-renewal-order', 'error', 'renewal_orders insert failed', {
      message: insertErr.message,
      bookingId,
    })
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  // Call KPay using the existing provider (no signing code changes).
  let providerResult: { providerOrderNo: string; payInfo: string; kind: string; expiresInSeconds: number }
  try {
    const provider = getPaymentProvider()
    const origin = new URL(request.url).origin
    providerResult = await provider.createOrder({
      outTradeNo: renewalId,
      bookingId,
      amount,
      method: paymentMethod as Parameters<typeof provider.createOrder>[0]['method'],
      mode: 'qr',
      baseUrl: origin,
    })
  } catch (err) {
    const e = err as Error
    console.error('[pilot/create-renewal-order] kpay createOrder failed', { message: e.message, renewalId })
    // Clean up the pending row so the idempotency guard doesn't block a retry.
    await service.from('renewal_orders').update({ status: 'failed' }).eq('id', renewalId)
    await logSiteError('pilot/create-renewal-order', 'error', 'kpay createOrder failed', {
      message: e.message,
      renewalId,
      bookingId,
    })
    if (e.message.startsWith('KPay 未配置完成')) return NextResponse.json({ error: e.message }, { status: 503 })
    if (e.message.startsWith('KPay 建單失敗') || e.message.startsWith('KPay 取碼失敗')) {
      return NextResponse.json({ error: e.message }, { status: 502 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }

  // Stamp provider_order_no conditionally (race-safe).
  const expiresAt = new Date(Date.now() + providerResult.expiresInSeconds * 1000).toISOString()
  const { error: stampErr } = await service
    .from('renewal_orders')
    .update({ provider_order_no: providerResult.providerOrderNo, expires_at: expiresAt })
    .eq('id', renewalId)
    .is('provider_order_no', null)

  if (stampErr) {
    console.error('[pilot/create-renewal-order] stamp failed', stampErr)
  }

  return NextResponse.json({
    renewal_order_id: renewalId,
    amount,
    qr_payload: providerResult.payInfo,
    expires_at: expiresAt,
    existing: false,
  })
}
