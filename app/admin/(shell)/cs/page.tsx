import CsCenter from '@/components/admin/CsCenter'

export const dynamic = 'force-dynamic'

export default async function CsPage({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const { case: caseId } = await searchParams
  const valid = typeof caseId === 'string' && /^[0-9a-f-]{36}$/i.test(caseId) ? caseId : null
  return <CsCenter initialCaseId={valid} />
}
