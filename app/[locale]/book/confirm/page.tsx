import ConfirmPageClient from "./ConfirmPageClient"

type Props = {
  searchParams: { bookingId?: string }
}

export default function Page({ searchParams }: Props) {
  const bookingId = typeof searchParams.bookingId === "string" ? searchParams.bookingId : ""

  if (!bookingId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-5 text-center text-white/60">
        <p data-cms-key="book.confirm.missing_booking">Unable to find this booking.</p>
      </main>
    )
  }

  return <ConfirmPageClient bookingId={bookingId} />
}
