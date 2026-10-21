import ConfirmPageClient, { type ConfirmBookingSummary } from "./ConfirmPageClient"
import { createClient } from "@/lib/supabase/server"

type Props = {
  searchParams: { bookingId?: string }
}

// Reads the signed-in customer's own booking(s) so the success screen can show
// the booking code and time instead of a raw UUID. RLS-scoped (user session),
// and any failure just falls back to the plain success screen.
async function loadSummary(bookingId: string): Promise<ConfirmBookingSummary[]> {
  try {
    const supabase = await createClient()
    const { data: first } = await supabase
      .from("bookings")
      .select("id, order_group_id")
      .eq("id", bookingId)
      .maybeSingle()
    if (!first) return []
    const query = supabase
      .from("bookings")
      .select("human_code, date, start_time, end_time, table_number")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
    const { data } = first.order_group_id
      ? await query.eq("order_group_id", first.order_group_id)
      : await query.eq("id", bookingId)
    return (data ?? []).map((r) => ({
      humanCode: typeof r.human_code === "string" ? r.human_code : null,
      date: String(r.date ?? ""),
      startTime: String(r.start_time ?? "").slice(0, 5),
      endTime: String(r.end_time ?? "").slice(0, 5),
      tableNumber: typeof r.table_number === "number" ? r.table_number : null,
    }))
  } catch {
    return []
  }
}

export default async function Page({ searchParams }: Props) {
  const bookingId = typeof searchParams.bookingId === "string" ? searchParams.bookingId : ""

  if (!bookingId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black px-5 text-center text-white/60">
        <p data-cms-key="book.confirm.missing_booking">Unable to find this booking.</p>
      </main>
    )
  }

  const summary = await loadSummary(bookingId)
  return <ConfirmPageClient bookingId={bookingId} summary={summary} />
}
