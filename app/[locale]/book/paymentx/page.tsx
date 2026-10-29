import PaymentXReturnClient from "@/components/paymentx/PaymentXReturnClient"

type Props = { searchParams: { bookingId?: string } }

// PaymentX (KPay 全托管收銀台) return page. KPay sends the customer back here whether they
// paid, cancelled or just closed the cashier, so this page never guesses: it asks the server,
// which asks KPay.
export default function Page({ searchParams }: Props) {
  const bookingId = typeof searchParams.bookingId === "string" ? searchParams.bookingId : ""
  return <PaymentXReturnClient bookingId={bookingId} />
}
