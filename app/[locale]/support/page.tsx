import { HelpCentre } from "@/components/help/HelpCentre";

export default function SupportPage({
  params,
}: {
  params: { locale: string };
}) {
  return <HelpCentre locale={params.locale as "zh-HK" | "zh-CN" | "en" | "ja"} />;
}
