import type { Metadata, Viewport } from "next";
import { Bebas_Neue } from "next/font/google";
import { getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Script from "next/script";
import SmoothScroll from "@/components/providers/smooth-scroll";
import "./globals.css";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://space8.com.hk"),
  title: "SPACE8 · 香港自助中式桌球 06:00-24:00",
  description:
    "香港首間自助中式桌球會所。即時預訂，Apple Pay付款，掃碼入場。專業球枱，私人空間，每日 06:00 至 24:00 營業。",
  verification: {
    google: "t5MhRgSpnnNRfckNMeR0y2ycI_HGgay1IalMFu4sUDI",
  },
  keywords: [
    "中式桌球",
    "桌球會",
    "香港桌球",
    "自助桌球",
    "snooker hong kong",
    "SPACE8",
  ],
  openGraph: {
    title: "SPACE8 · 屬於你的空間",
    description: "香港首間自助中式桌球會所。即時預訂，每日 06:00 至 24:00 營業。",
    url: "https://space8.com.hk",
    siteName: "SPACE8",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SPACE8",
      },
    ],
    locale: "zh_HK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPACE8",
    description: "香港首間自助中式桌球會所",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "48x48" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/web-app-manifest-192x192.png", sizes: "192x192" },
    ],
    apple: "/favicon/apple-touch-icon.png",
    shortcut: "/favicon/favicon.ico",
  },
  manifest: "/favicon/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Routes outside [locale] (e.g. /login, /member, /admin) never set a request
  // locale, so this falls back to routing.defaultLocale for them — still
  // correct, since those routes render zh-HK-only chrome around client-side
  // locale-aware content.
  const locale = await getLocale().catch(() => routing.defaultLocale);

  return (
    <html lang={locale} className={`${bebasNeue.variable} no-js`}>
      <body className="min-h-screen bg-black text-white antialiased">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}`}
        strategy="lazyOnload"
      />
    </html>
  );
}
