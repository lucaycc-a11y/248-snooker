import type { Metadata } from "next";

// Booking steps are per-user and transient — never index them.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
