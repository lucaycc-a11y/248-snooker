import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ShoppingBag, AlertTriangle } from 'lucide-react'

async function getTodayBookings() {
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
    .select('*')
    .eq('date', new Date().toISOString().split('T')[0])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching today bookings:', error)
    return []
  }

  return data || []
}

async function getAnomalousPayments() {
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

  // Orphaned payment attempts (no booking_id)
  const { data: orphanedAttempts } = await supabase
    .from('payment_attempts')
    .select('*')
    .is('booking_id', null)
    .order('created_at', { ascending: false })
    .limit(10)

  // Webhook events that don't match any payment_attempt
  const { data: orphanedWebhooks } = await supabase
    .from('webhook_events')
    .select('*')
    .not('payment_intent_id', 'in', `(SELECT stripe_payment_intent_id FROM payment_attempts WHERE stripe_payment_intent_id IS NOT NULL)`)
    .order('created_at', { ascending: false })
    .limit(10)

  return {
    orphanedAttempts: orphanedAttempts || [],
    orphanedWebhooks: orphanedWebhooks || [],
  }
}

export default async function AdminDashboard() {
  const todayBookings = await getTodayBookings()
  const anomalies = await getAnomalousPayments()

  const totalAnomalies =
    anomalies.orphanedAttempts.length + anomalies.orphanedWebhooks.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">營運概況</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">今日訂單</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayBookings.length}</div>
            <p className="text-xs text-muted-foreground">
              {new Date().toLocaleDateString('zh-HK', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">異常付款</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">{totalAnomalies}</div>
              {totalAnomalies > 0 && (
                <Badge variant="destructive">需處理</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {anomalies.orphanedAttempts.length} 孤立嘗試 /{' '}
              {anomalies.orphanedWebhooks.length} 孤立 webhook
            </p>
          </CardContent>
        </Card>
      </div>

      {todayBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>今日訂單明細</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayBookings.slice(0, 5).map((booking) => (
                <div
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium">{booking.name || '未命名'}</p>
                    <p className="text-sm text-muted-foreground">
                      {booking.table_number} 號檯 · {booking.start_time} -{' '}
                      {booking.end_time}
                    </p>
                  </div>
                  <Badge
                    variant={
                      booking.status === 'confirmed' ? 'default' : 'secondary'
                    }
                  >
                    {booking.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
