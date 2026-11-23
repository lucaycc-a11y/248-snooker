import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import Nav from "@/components/layout/Nav";
import Footer from "@/components/layout/Footer";
import PilotIntro from "@/app/member/PilotIntro";
import { createClient } from "@/lib/supabase/server";

// Beta: admin-only until Space Pilot opens to a small group of players.
// The check runs on the server so non-admins get a 404, not just a hidden link.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Space Pilot",
  robots: { index: false, follow: false },
};

async function isActiveAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("admin_users")
    .select("is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

export default async function SpacePilotPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!(await isActiveAdmin())) notFound();

  return (
    <main className="relative overflow-x-clip bg-black">
      <Nav />
      <PilotIntro variant="page" />
      <Footer />
    </main>
  );
}
