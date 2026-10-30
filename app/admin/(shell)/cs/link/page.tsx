import { redirect } from 'next/navigation'

// Identity check and payment links are now steps inside a case workflow.
export default function CsStepRedirect() {
  redirect('/admin/cs')
}
