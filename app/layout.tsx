import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Space8 · 香港自助中式桌球 06:00-24:00",
  description:
    "香港首間自助中式桌球會所。即時預訂，Apple Pay付款，掃碼入場。專業球枱，私人空間，每日 06:00 至 24:00 營業。",
  keywords: [
    "中式桌球",
    "桌球會",
    "香港桌球",
    "自助桌球",
    "snooker hong kong",
    "Space8",
  ],
  openGraph: {
    title: "Space8 · 屬於你的主場",
    description: "香港首間自助中式桌球會所。即時預訂，每日 06:00 至 24:00 營業。",
    url: "https://248.formhk.com",
    siteName: "Space8",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Space8",
      },
    ],
    locale: "zh_HK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Space8",
    description: "香港首間自助中式桌球會所",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/web-app-manifest-192x192.png", sizes: "192x192" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Static JSON-LD — no user input, safe to inline.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: "Space8",
    description: "香港首間自助英式桌球預訂平台，每日 06:00 至 24:00 營業",
    url: "https://248.formhk.com",
    telephone: "+85264274620",
    address: {
      "@type": "PostalAddress",
      addressCountry: "HK",
      addressRegion: "Hong Kong",
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "06:00",
      closes: "24:00",
    },
    priceRange: "HK$60-120/hr",
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Self-service booking", value: true },
      { "@type": "LocationFeatureSpecification", name: "Apple Pay", value: true },
    ],
  };

  return (
    <html lang="zh-HK">
      <body className="min-h-screen bg-black text-white antialiased">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
