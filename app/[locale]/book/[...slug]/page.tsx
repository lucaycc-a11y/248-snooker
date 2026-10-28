import { redirect } from '@/i18n/navigation'
import { logSiteError } from '@/lib/errors/log'

// Safety net for the payment flow: any /book/<unknown path> (an old gateway return link,
// a mistyped or truncated URL, a stale history entry) lands on the booking screen instead
// of a 404, keeping the booking id so the status / confirm screen can still be shown.
// The path is logged so a bad return URL can be traced afterwards.

type Props = {
  params: { locale: string; slug: string[] }
  searchParams: Record<string, string | string[] | undefined>
}

export default async function Page({ params, searchParams }: Props) {
  const bookingId = typeof searchParams.bookingId === 'string' ? searchParams.bookingId : ''
  try {
    await logSiteError('payments/book-unknown-path', 'warning', `Unknown /book path: /${params.slug.join('/')}`, {
      path: params.slug,
      hasBookingId: !!bookingId,
      query: Object.keys(searchParams),
    })
  } catch {
    /* logging must never block the redirect */
  }
  const href = bookingId
    ? `/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=returned`
    : '/book'
  redirect({ href, locale: params.locale })
}
