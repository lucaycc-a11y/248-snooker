import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "248 桌球會 · 香港24小時中式桌球",
  description:
    "香港首間24小時自助中式桌球會所。即時預訂，Apple Pay付款，掃碼入場。專業球枱，私人空間，全年無休。",
  keywords: [
    "中式桌球",
    "桌球會",
    "香港桌球",
    "24小時桌球",
    "自助桌球",
    "snooker hong kong",
    "248桌球",
  ],
  openGraph: {
    title: "248 桌球會 · 屬於你的主場",
    description: "香港首間24小時中式桌球會所。即時預訂，全年無休。",
    url: "https://248.formhk.com",
    siteName: "248 桌球會",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "248 桌球會",
      },
    ],
    locale: "zh_HK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "248 桌球會",
    description: "香港首間24小時中式桌球會所",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-HK">
      <body className="min-h-screen bg-black text-white antialiased">
        {children}
      </body>
    </html>
  );
}
