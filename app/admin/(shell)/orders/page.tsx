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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

async function getAllBookings() {
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
    .from('bookings')
    .select(`
      *,
      payment_attempts(*)
    `)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching bookings:', error)
    return []
  }

  return data || []
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'confirmed':
      return 'default'
    case 'pending':
      return 'secondary'
    case 'cancelled':
      return 'destructive'
    default:
      return 'secondary'
  }
}

export default async function OrdersPage() {
  const bookings = await getAllBookings()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">訂單查詢</h1>
        <p className="text-muted-foreground">所有訂單記錄</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>訂單列表 ({bookings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>訂單編號</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>檯號</TableHead>
                  <TableHead>姓名</TableHead>
                  <TableHead>金額</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>付款狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center">
                      暫無訂單記錄
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => {
                    const paymentAttempt = Array.isArray(booking.payment_attempts)
                      ? booking.payment_attempts[0]
                      : null

                    return (
                      <TableRow key={booking.id}>
                        <TableCell className="font-mono text-xs">
                          {booking.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>{booking.date}</TableCell>
                        <TableCell>
                          {booking.start_time} - {booking.end_time}
                        </TableCell>
                        <TableCell>{booking.table_number}</TableCell>
                        <TableCell>{booking.name || '-'}</TableCell>
                        <TableCell className="font-medium">
                          HK${booking.total_price}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusVariant(booking.status)}>
                            {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {paymentAttempt ? (
                            <Badge
                              variant={
                                paymentAttempt.status === 'succeeded'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {paymentAttempt.status}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              無付款記錄
                            </span>
                          )}
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
