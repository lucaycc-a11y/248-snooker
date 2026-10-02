import { redirect } from 'next/navigation'
import { HELP_PATHS } from '@/lib/help/constants'

export default function FaqPage() {
  redirect(HELP_PATHS.home)
}
