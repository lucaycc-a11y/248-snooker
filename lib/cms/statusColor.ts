import { tokens } from '@/app/styles/tokens'

// Shared draft/published/reverted status color convention — originally
// inline in CMSHistoryList.tsx, lifted out so CMSEditor.tsx's row badges use
// the identical mapping instead of a second copy.
export function statusColor(status: string): string {
  if (status === 'published') return tokens.colors.brand
  if (status === 'reverted') return tokens.colors.textFaint
  return '#eab308' // draft
}
