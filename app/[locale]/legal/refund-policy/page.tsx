import { redirect } from "next/navigation"

export default function RefundPolicyPage({
  params,
}: {
  params: { locale: string }
}) {
  // The refund/overtime terms live in the 場地守則 (terms) document's
  // 三、時段控管及超時收費 and 六、惡劣天氣特殊安排 sections — deep-link to that tab.
  redirect(`/${params.locale}/legal?doc=terms`)
}
