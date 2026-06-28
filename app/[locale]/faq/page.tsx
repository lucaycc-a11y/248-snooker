import type { Metadata } from "next";
import Nav from "@/components/layout/Nav";
import FAQ from "@/components/landing/FAQ";

export const metadata: Metadata = {
  title: "常見問題 | 248 桌球會 — 香港24小時自助桌球",
  description:
    "248桌球會常見問題解答：預訂流程、入場方式、收費、取消政策、會員積分制度等。香港首間24小時自助桌球會所。",
  keywords:
    "桌球,香港桌球,24小時桌球,自助桌球,桌球預訂,snooker hong kong",
  alternates: {
    canonical: "https://248.formhk.com/faq",
  },
};

export default function FaqPage() {
  return (
    <main className="relative bg-black">
      <Nav />
      <FAQ />
    </main>
  );
}
