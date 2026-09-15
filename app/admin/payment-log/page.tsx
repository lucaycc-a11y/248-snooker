import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function getPaymentAttempts() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component restriction
          }
        },
      },
    }
  )

  const { data, error } = await supabase
    .from('payment_attempts')
    .select(`
      *,
      bookings(id, date, table_number, name)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching payment attempts:', error)
    return []
  }

  return data || []
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'succeeded':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'failed':
    case 'canceled':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export default async function PaymentLogPage() {
  const paymentAttempts = await getPaymentAttempts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payment Log</h1>
        <p className="text-muted-foreground">所有付款記錄</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>付款嘗試 ({paymentAttempts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Intent ID</TableHead>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>訂單資訊</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>建立時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentAttempts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center">
                      暫無付款記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  paymentAttempts.map((attempt) => {
                    const booking = Array.isArray(attempt.bookings)
                      ? attempt.bookings[0]
                      : attempt.bookings
                    const hasAnomaly = !attempt.booking_id

                    return (
                      <TableRow
                        key={attempt.id}
                        className={hasAnomaly ? 'bg-destructive/5' : ''}
                      >
                        <TableCell className="font-mono text-xs">
                          {attempt.stripe_payment_intent_id?.slice(0, 20)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {attempt.booking_id ? (
                            attempt.booking_id.slice(0, 8) + '...'
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              孤立記錄
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {booking ? (
                            <div className="text-sm">
                              <div className="font-medium">
                                {booking.name || '-'}
                              </div>
                              <div className="text-muted-foreground">
                                {booking.date} · {booking.table_number} 號檯
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              無訂單關聯
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {attempt.amount
                            ? `HK$${(attempt.amount / 100).toFixed(2)}`
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(attempt.status)}>
                            {attempt.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(attempt.created_at).toLocaleString('zh-HK')}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
