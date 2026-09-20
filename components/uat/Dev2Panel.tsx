'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { X, RefreshCw, Trash2, Check, AlertCircle, GitBranch, Play, Shield, ArrowRight, ShieldAlert, Rocket } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatVersion } from '@/lib/version'
import { toast } from 'sonner'

type EnvInfo = {
  env: string
  admin: {
    userId: string
    email: string
    role: string
    displayName: string | null
  }
  clientIp: string
  isIpWhitelisted: boolean
  gateEnabled: boolean
  gateReason: string | null
  activeTestPrice: {
    mode: string
    amount: number
    label: string | null
  } | null
}

type DeployStatus = {
  uatSha: string
  uatMessage: string
  mainSha: string
  mainMessage: string
  uatAhead: number
  gateEnabled: boolean
}

type GitStatus = {
  uat: { sha: string; message: string }
  main: { sha: string; message: string }
  diverged: boolean
}

type Payment = {
  id: string
  total_price: number
  payment_method: string
  payment_status: string
  is_test: boolean
  created_at: string
}

type AuthEvent = {
  id: string
  user_id: string
  action: string
  details: any
  created_at: string
}

type WhitelistEntry = {
  ip_address: string
  label: string | null
  added_at: string
}

type PendingRequest = {
  ip: string
  firstSeen: string
  lastSeen: string
  count: number
  userAgent: string | null
}

type ActivityLogEntry = {
  timestamp: string
  type: 'log' | 'warn' | 'error' | 'fetch'
  message: string
  data?: any
}

type Dev2PanelProps = {
  onClose?: () => void
}

export function Dev2Panel({ onClose }: Dev2PanelProps) {
  const [activeTab, setActiveTab] = useState('env')

  return (
    <div className="p-6 max-h-[90vh] overflow-auto bg-background">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1">
            Dev2 Panel · {formatVersion()}
          </h1>
          <p className="text-sm text-muted-foreground">
            UAT testing and deployment management
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="env">Env Info</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="payment">Payment Log</TabsTrigger>
          <TabsTrigger value="auth">Auth Log</TabsTrigger>
          <TabsTrigger value="ip">IP Whitelist</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="env">
          <EnvInfoTab />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogTab />
        </TabsContent>

        <TabsContent value="payment">
          <PaymentLogTab />
        </TabsContent>

        <TabsContent value="auth">
          <AuthLogTab />
        </TabsContent>

        <TabsContent value="ip">
          <IpWhitelistTab />
        </TabsContent>

        <TabsContent value="deploy">
          <DeployTab />
        </TabsContent>

        <TabsContent value="actions">
          <QuickActionsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Env Info Tab Component
function EnvInfoTab() {
  const [data, setData] = useState<EnvInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dev2/env-info')
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch((err) => {
        toast.error('Failed to load environment info')
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive py-4">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load environment info</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Environment Information</CardTitle>
        <CardDescription>Current system state and admin context</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <InfoRow label="Environment" value={data.env} badge={data.env === 'uat' ? 'secondary' : 'default'} />
          <Separator className="my-3" />
          <InfoRow label="Admin Email" value={data.admin.email} />
          <InfoRow label="Role" value={data.admin.role} />
          <InfoRow label="Display Name" value={data.admin.displayName || '(none)'} />
          <Separator className="my-3" />
          <InfoRow label="Client IP" value={data.clientIp} mono />
          <InfoRow
            label="IP Whitelisted"
            value={data.isIpWhitelisted ? '✓ Yes' : '✗ No'}
            badge={data.isIpWhitelisted ? 'default' : 'secondary'}
          />
          <Separator className="my-3" />
          <InfoRow
            label="Gate Enabled"
            value={data.gateEnabled ? `✓ Yes (${data.gateReason || 'unknown'})` : '✗ No'}
            badge={data.gateEnabled ? 'destructive' : 'default'}
          />
          {data.activeTestPrice && (
            <>
              <Separator className="my-3" />
              <InfoRow
                label="Active Test Price"
                value={`${data.activeTestPrice.mode}: HK$${data.activeTestPrice.amount} ${data.activeTestPrice.label ? `(${data.activeTestPrice.label})` : ''}`}
                mono
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  badge,
  mono = false,
}: {
  label: string
  value: string
  badge?: 'default' | 'destructive' | 'secondary'
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50 transition-colors">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant={badge} className={`font-mono text-xs px-3 py-1 ${mono ? 'font-mono' : ''}`}>
          {value}
        </Badge>
      ) : (
        <span className={`text-sm font-semibold ${mono ? 'font-mono' : ''}`}>{value}</span>
      )}
    </div>
  )
}

// Activity Log Tab Component
function ActivityLogTab() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const maxLogs = 200

  useEffect(() => {
    // Capture console methods
    const originalLog = console.log
    const originalWarn = console.warn
    const originalError = console.error
    const originalFetch = window.fetch

    console.log = (...args: any[]) => {
      originalLog(...args)
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'log' as const, message: args.join(' ') }, ...prev].slice(0, maxLogs)
      )
    }

    console.warn = (...args: any[]) => {
      originalWarn(...args)
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'warn' as const, message: args.join(' ') }, ...prev].slice(0, maxLogs)
      )
    }

    console.error = (...args: any[]) => {
      originalError(...args)
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'error' as const, message: args.join(' ') }, ...prev].slice(0, maxLogs)
      )
    }

    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = init?.method || 'GET'
      setLogs((prev) =>
        [{ timestamp: new Date().toISOString(), type: 'fetch' as const, message: `${method} ${url}` }, ...prev].slice(0, maxLogs)
      )
      return originalFetch(input, init)
    }

    return () => {
      console.log = originalLog
      console.warn = originalWarn
      console.error = originalError
      window.fetch = originalFetch
    }
  }, [])

  function copyAll() {
    const text = logs.map((l) => `[${l.timestamp}] ${l.type.toUpperCase()}: ${l.message}`).join('\n')
    navigator.clipboard.writeText(text)
    toast.success('Copied all logs to clipboard')
  }

  function clear() {
    setLogs([])
    toast.info('Activity log cleared')
  }

  const typeColor = (type: string) => {
    switch (type) {
      case 'log':
        return 'text-foreground'
      case 'warn':
        return 'text-orange-500'
      case 'error':
        return 'text-destructive'
      case 'fetch':
        return 'text-cyan-500'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Activity Log</CardTitle>
            <CardDescription>Console output and network requests</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {logs.length} / {maxLogs}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={copyAll} variant="default" size="sm" disabled={logs.length === 0}>
            Copy All
          </Button>
          <Button onClick={clear} variant="secondary" size="sm" disabled={logs.length === 0}>
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        <div className="bg-black/95 p-4 rounded-lg max-h-[500px] overflow-auto font-mono text-xs border border-border">
          {logs.length === 0 && <div className="text-muted-foreground italic">No activity logged yet</div>}
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${typeColor(log.type)}`}>
              <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
              <span className="font-semibold">{log.type.toUpperCase()}:</span> {log.message}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Payment Log Tab Component
function PaymentLogTab() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/payment-log')
      if (res.ok) {
        const json = await res.json()
        setPayments(json.payments)
      } else {
        toast.error('Failed to load payment log')
      }
    } catch (err) {
      toast.error('Failed to load payment log')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Payment Log</CardTitle>
            <CardDescription>Recent bookings and payment status</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {payments.length} records
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="p-3 text-left font-semibold">ID</th>
                <th className="p-3 text-left font-semibold">Amount</th>
                <th className="p-3 text-left font-semibold">Method</th>
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Test</th>
                <th className="p-3 text-left font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground italic">
                    No payments found
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-mono text-xs">{p.id.slice(0, 8)}</td>
                  <td className="p-3 font-semibold">HK${p.total_price}</td>
                  <td className="p-3 capitalize">{p.payment_method}</td>
                  <td className="p-3">
                    <Badge variant={p.payment_status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                      {p.payment_status}
                    </Badge>
                  </td>
                  <td className="p-3">{p.is_test ? <Badge variant="secondary" className="text-xs">Test</Badge> : ''}</td>
                  <td className="p-3 text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// Auth Log Tab Component
function AuthLogTab() {
  const [events, setEvents] = useState<AuthEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/auth-log')
      if (res.ok) {
        const json = await res.json()
        setEvents(json.authEvents)
      } else {
        toast.error('Failed to load auth log')
      }
    } catch (err) {
      toast.error('Failed to load auth log')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-muted shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Auth Log</CardTitle>
            <CardDescription>Authentication and authorization events</CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs font-mono">
            {events.length} events
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="p-3 text-left font-semibold">Timestamp</th>
                <th className="p-3 text-left font-semibold">User</th>
                <th className="p-3 text-left font-semibold">Action</th>
                <th className="p-3 text-left font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground italic">
                    No auth events found
                  </td>
                </tr>
              )}
              {events.map((e) => (
                <tr key={e.id} className="border-b hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="p-3 font-mono text-xs">{e.user_id.slice(0, 8)}</td>
                  <td className="p-3 font-semibold">{e.action}</td>
                  <td className="p-3 text-xs font-mono text-muted-foreground">{JSON.stringify(e.details).slice(0, 60)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// IP Whitelist Tab Component
function IpWhitelistTab() {
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([])
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [newIp, setNewIp] = useState('')
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [ipToRemove, setIpToRemove] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      const res = await fetch('/api/dev2/ip-whitelist')
      if (res.ok) {
        const json = await res.json()
        setWhitelist(json.whitelist)
        setPending(json.pending)
      } else {
        toast.error('Failed to load IP whitelist')
      }
    } catch (err) {
      toast.error('Failed to load IP whitelist')
    } finally {
      setLoading(false)
    }
  }

  async function addIp() {
    if (!newIp.trim()) {
      toast.error('Please enter an IP address')
      return
    }
    try {
      const res = await fetch('/api/dev2/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: newIp.trim() }),
      })
      if (res.ok) {
        toast.success(`Added ${newIp.trim()} to whitelist`)
        setNewIp('')
        await fetchData()
      } else {
        toast.error('Failed to add IP')
      }
    } catch (err) {
      toast.error('Failed to add IP')
    }
  }

  async function confirmRemoveIp() {
    try {
      const res = await fetch('/api/dev2/ip-whitelist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: ipToRemove }),
      })
      if (res.ok) {
        toast.success(`Removed ${ipToRemove} from whitelist`)
      } else {
        toast.error('Failed to remove IP')
      }
    } catch (err) {
      toast.error('Failed to remove IP')
    }
    setShowRemoveDialog(false)
    setIpToRemove('')
    await fetchData()
  }

  async function approveIp(ip: string) {
    const label = prompt(`Approve ${ip}. Optional label:`)
    if (label === null) return
    try {
      const res = await fetch('/api/dev2/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, label }),
      })
      if (res.ok) {
        toast.success(`Approved ${ip}`)
        await fetchData()
      } else {
        toast.error('Failed to approve IP')
      }
    } catch (err) {
      toast.error('Failed to approve IP')
    }
  }

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <Card className="border-muted shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Add IP Address</CardTitle>
            <CardDescription>Manually add an IP to the whitelist</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIp()}
                placeholder="192.168.1.1"
                className="font-mono"
              />
              <Button onClick={addIp}>Add</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Whitelisted IPs</CardTitle>
                <CardDescription>Currently approved IP addresses</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {whitelist.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {whitelist.length === 0 && (
                <div className="p-6 text-center text-muted-foreground italic">No whitelisted IPs</div>
              )}
              {whitelist.map((w) => (
                <div key={w.ip_address} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-mono font-semibold text-sm">{w.ip_address}</div>
                    {w.label && <div className="text-sm text-muted-foreground mt-1">{w.label}</div>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIpToRemove(w.ip_address)
                      setShowRemoveDialog(true)
                    }}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Pending Requests</CardTitle>
                <CardDescription>Blocked access attempts awaiting approval</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-mono">
                {pending.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.length === 0 && (
                <div className="p-6 text-center text-muted-foreground italic">No pending requests</div>
              )}
              {pending.map((p) => (
                <div key={p.ip} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-muted gap-4 hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="font-mono font-semibold text-sm">{p.ip}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {p.count} attempts · Last: {new Date(p.lastSeen).toLocaleString()}
                    </div>
                    {p.userAgent && (
                      <div className="text-xs text-muted-foreground mt-2 font-mono">{p.userAgent.slice(0, 80)}</div>
                    )}
                  </div>
                  <Button variant="default" size="sm" onClick={() => approveIp(p.ip)}>
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove IP from whitelist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <span className="font-mono font-semibold">{ipToRemove}</span> from the whitelist.
              They will be blocked on next request.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIpToRemove('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveIp} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Deploy Tab Component
function DeployTab() {
  const [status, setStatus] = useState<DeployStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [showPushDialog, setShowPushDialog] = useState(false)
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false)
  const [showGoLiveDialog, setShowGoLiveDialog] = useState(false)
  const [confirmation, setConfirmation] = useState('')

  useEffect(() => {
    fetchStatus()
  }, [])

  async function fetchStatus() {
    try {
      const res = await fetch('/api/dev2/git-status')
      if (res.ok) {
        const json = await res.json()
        setStatus(json)
      } else {
        toast.error('Failed to load git status')
      }
    } catch (err) {
      toast.error('Failed to load git status')
    } finally {
      setLoading(false)
    }
  }

  async function executePush(enableGate: boolean) {
    setDeploying(true)
    try {
      const res = await fetch('/api/dev2/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enableGate }),
      })
      const json = await res.json()
      if (res.ok) {
        toast.success(json.message || 'Deploy successful')
        await fetchStatus()
      } else {
        toast.error(json.error || 'Deploy failed')
      }
    } catch (err) {
      toast.error('Deploy failed')
    } finally {
      setDeploying(false)
      setShowPushDialog(false)
      setShowMaintenanceDialog(false)
      setShowGoLiveDialog(false)
      setConfirmation('')
    }
  }

  if (loading) {
    return (
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!status) return null

  const isDiverged = status.uatAhead > 0

  return (
    <>
      <div className="space-y-6">
        <Card className="border-muted shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Branch Status</CardTitle>
            <CardDescription>Current deployment state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="p-3 bg-muted/30 rounded-lg border border-muted">
                <div className="text-sm font-medium text-muted-foreground mb-2">UAT Branch</div>
                <div className="font-mono text-xs">
                  <span className="font-semibold">{status.uatSha.slice(0, 7)}</span> — {status.uatMessage}
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg border border-muted">
                <div className="text-sm font-medium text-muted-foreground mb-2">Main Branch</div>
                <div className="font-mono text-xs">
                  <span className="font-semibold">{status.mainSha.slice(0, 7)}</span> — {status.mainMessage}
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">UAT ahead of main</span>
              {isDiverged ? (
                <Badge variant="secondary" className="font-mono text-xs">
                  +{status.uatAhead} commits
                </Badge>
              ) : (
                <Badge variant="default" className="text-xs">In sync</Badge>
              )}
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm font-medium">Site Gate</span>
              <Badge variant={status.gateEnabled ? 'destructive' : 'default'} className="text-xs">
                {status.gateEnabled ? '🔒 Enabled' : '🟢 Open'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-muted shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Deployment Actions</CardTitle>
            <CardDescription>Merge and deploy operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => setShowPushDialog(true)}
              disabled={!isDiverged || deploying}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Push to Production (gate unchanged)
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => setShowMaintenanceDialog(true)}
              disabled={!isDiverged || deploying}
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              Push + Enable Maintenance Mode
            </Button>
            {status.gateEnabled && (
              <Button
                variant="default"
                className="w-full justify-start bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowGoLiveDialog(true)}
                disabled={deploying}
              >
                <Rocket className="h-4 w-4 mr-2" />
                Open Site Gate (Go Live)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Push Dialog */}
      <AlertDialog open={showPushDialog} onOpenChange={setShowPushDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Push to Production?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <span className="font-mono">uat</span> into <span className="font-mono">main</span> and
              trigger a production deploy. The site gate will remain{' '}
              <strong>{status?.gateEnabled ? 'ENABLED' : 'OPEN'}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder='Type "PUSH" to confirm'
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmation('')
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={confirmation !== 'PUSH' || deploying} onClick={() => executePush(status?.gateEnabled || false)}>
              {deploying ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Push Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Maintenance Dialog */}
      <AlertDialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Push + Enable Maintenance?</AlertDialogTitle>
            <AlertDialogDescription>
              This will merge <span className="font-mono">uat</span> into <span className="font-mono">main</span>,
              deploy to production, and <strong className="text-destructive">ENABLE THE SITE GATE</strong>. Visitors
              will see the maintenance page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder='Type "PUSH" to confirm'
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmation('')
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmation !== 'PUSH' || deploying}
              onClick={() => executePush(true)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deploying ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Push + Enable Gate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Go Live Dialog */}
      <AlertDialog open={showGoLiveDialog} onOpenChange={setShowGoLiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Open Site Gate?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong className="text-green-600">DISABLE THE SITE GATE</strong> and allow public access to the
              site immediately. No code is deployed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder='Type "GO LIVE" to confirm'
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmation('')
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmation !== 'GO LIVE' || deploying}
              onClick={() => executePush(false)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {deploying ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              Go Live Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// Quick Actions Tab Component
function QuickActionsTab() {
  const [mode, setMode] = useState<'flat' | 'per-hour'>('flat')
  const [amount, setAmount] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  async function confirmSubmit() {
    setLoading(true)
    try {
      const res = await fetch('/api/dev2/test-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          amount: parseFloat(amount),
          label: label.trim() || undefined,
        }),
      })
      if (res.ok) {
        toast.success('Test price updated successfully')
        setAmount('')
        setLabel('')
      } else {
        const json = await res.json()
        toast.error(json.error || 'Failed to update test price')
      }
    } catch (err) {
      toast.error('Failed to update test price')
    } finally {
      setLoading(false)
      setShowConfirmDialog(false)
    }
  }

  return (
    <>
      <Card className="border-muted shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">UAT Test Pricing</CardTitle>
          <CardDescription>Override booking prices for UAT testing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Pricing Mode</label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'flat' | 'per-hour')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flat">Flat Rate</SelectItem>
                <SelectItem value="per-hour">Per Hour</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Amount (HK$)</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              min="0"
              step="0.01"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Label (optional)</label>
            <Input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Weekend Special"
            />
          </div>

          <Button
            onClick={() => setShowConfirmDialog(true)}
            disabled={!amount || loading}
            className="w-full"
            variant="default"
          >
            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Set Test Price
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Test Price</AlertDialogTitle>
            <AlertDialogDescription>
              Set UAT test price to{' '}
              <strong className="font-mono">
                HK${amount} ({mode})
              </strong>
              {label && (
                <>
                  {' '}
                  with label "<strong>{label}</strong>"
                </>
              )}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSubmit} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
