import type { Metadata } from "next"

// PaymentX return page is per-user and transient — never index it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PaymentXLayout({ children }: { children: React.ReactNode }) {
  return children
}
