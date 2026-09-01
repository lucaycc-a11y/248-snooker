import { redirect } from "next/navigation"

export default function RefundPolicyPage({
  params,
}: {
  params: { locale: string }
}) {
  // Deep-link to the refund policy tab on the unified legal page.
  redirect(`/${params.locale}/legal?doc=refund_policy`)
}
