import { redirect } from "next/navigation"

export default function RefundPolicyPage({
  params,
}: {
  params: { locale: string }
}) {
  // Redirect to legal page with refund tab pre-selected
  redirect(`/${params.locale}/legal?tab=refund`)
}
