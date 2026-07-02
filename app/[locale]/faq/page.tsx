import type { Metadata } from "next";
import Nav from "@/components/layout/Nav";
import FAQ from "@/components/landing/FAQ";

export const metadata: Metadata = {
  title: "常見問題 | Space8 — 香港自助桌球 06:00-24:00營業",
  description:
    "Space8常見問題解答：預訂流程、入場方式、收費、取消政策、會員積分制度等。香港首間自助桌球會所，每日06:00至24:00營業。",
  keywords:
    "桌球,香港桌球,桌球會所,自助桌球,桌球預訂,snooker hong kong",
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
