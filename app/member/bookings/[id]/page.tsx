import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMemberData, getMemberTicket } from "@/lib/data/getMember";
import { resolveLocaleFromCookie, loadMessages } from "@/lib/i18n/serverLocale";
import { BackButton } from "@/components/ui";
import { TicketCard } from "@/components/booking/TicketCard";

export const metadata: Metadata = {
  title: "我的預訂 | Space8",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function MemberBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Same auth gate as /member — unauthenticated visitors go to login with a
  // returnUrl back to this exact ticket instead of a bare 404.
  const member = await getMemberData();
  if (!member) redirect(`/login?returnUrl=/member/bookings/${id}`);

  const ticket = await getMemberTicket(id);
  // Not found or owned by someone else — getMemberTicket scopes the query to
  // the caller's own user_id, so this also covers "not yours" without leaking
  // whether the booking exists.
  if (!ticket) notFound();

  const locale = await resolveLocaleFromCookie();
  const messages = await loadMessages(locale);

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main
        style={{
          background: "#000",
          minHeight: "100dvh",
          display: "flex",
          justifyContent: "center",
          padding: "96px 20px 48px",
        }}
      >
        <BackButton href="/member" ariaLabel="返回" color="#fff" />
        <div style={{ width: "100%", maxWidth: 400 }}>
          <TicketCard
            date={ticket.date}
            startHour={ticket.startHour}
            duration={ticket.duration}
            tableNumber={ticket.tableNumber}
            bookingRef={ticket.bookingRef}
            qrData={ticket.qrData}
            totalPrice={ticket.totalPrice}
            paymentMethod={ticket.paymentMethod}
            defaultExpanded
          />
        </div>
      </main>
    </NextIntlClientProvider>
  );
}
