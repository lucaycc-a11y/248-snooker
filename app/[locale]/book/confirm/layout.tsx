import type { Metadata } from "next";

// Booking confirmation is per-user and transient — never index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
