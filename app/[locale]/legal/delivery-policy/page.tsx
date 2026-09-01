import { redirect } from "next/navigation"

export default function DeliveryPolicyPage({
  params,
}: {
  params: { locale: string }
}) {
  // Deep-link to the delivery policy tab on the unified legal page.
  redirect(`/${params.locale}/legal?doc=delivery_policy`)
}
