import { redirect } from "@/i18n/navigation"

type Props = {
  params: { locale: string }
  searchParams: { bookingId?: string }
}

// /book/confirm is only a legacy landing spot (the gateway history entry and
// older return URLs point here). It is NOT a payment confirmation page: the
// real one is the ticket screen on /book, which already handles pending,
// confirmed and failed states. Send everyone there immediately so nobody sits
// on an interstitial spinner.
export default function Page({ params, searchParams }: Props) {
  const bookingId = typeof searchParams.bookingId === "string" ? searchParams.bookingId : ""
  const href = bookingId
    ? `/book?bookingId=${encodeURIComponent(bookingId)}&redirect_status=returned`
    : "/book"
  redirect({ href, locale: params.locale })
}
