'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/Badge'
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
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load environment info</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Environment Information</CardTitle>
        <CardDescription>Current system state and admin context</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <InfoRow label="Environment" value={data.env} />
        <Separator />
        <InfoRow label="Admin Email" value={data.admin.email} />
        <InfoRow label="Role" value={data.admin.role} />
        <InfoRow label="Display Name" value={data.admin.displayName || '(none)'} />
        <Separator />
        <InfoRow label="Client IP" value={data.clientIp} />
        <InfoRow
          label="IP Whitelisted"
          value={data.isIpWhitelisted ? '✓ Yes' : '✗ No'}
          badge={data.isIpWhitelisted ? 'default' : 'destructive'}
        />
        <Separator />
        <InfoRow
          label="Gate Enabled"
          value={data.gateEnabled ? `✓ Yes (${data.gateReason || 'unknown'})` : '✗ No'}
          badge={data.gateEnabled ? 'destructive' : 'default'}
        />
        <Separator />
        {data.activeTestPrice && (
          <InfoRow
            label="Active Test Price"
            value={`${data.activeTestPrice.mode}: HK$${data.activeTestPrice.amount} ${data.activeTestPrice.label ? `(${data.activeTestPrice.label})` : ''}`}
          />
        )}
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value, badge }: { label: string; value: string; badge?: 'default' | 'destructive' }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      {badge ? (
        <Badge variant={badge} className="font-mono text-xs">
          {value}
        </Badge>
      ) : (
        <span className="text-sm font-mono font-semibold">{value}</span>
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
  }

  function clear() {
    setLogs([])
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Activity Log</CardTitle>
            <CardDescription>Console output and network requests</CardDescription>
          </div>
          <span className="text-sm text-muted-foreground">
            {logs.length} / {maxLogs} entries
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={copyAll} variant="default" size="sm">
            Copy All
          </Button>
          <Button onClick={clear} variant="secondary" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
        <div className="bg-black p-4 rounded-lg max-h-[500px] overflow-auto font-mono text-xs">
          {logs.length === 0 && <div className="text-muted-foreground">No activity logged yet</div>}
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${typeColor(log.type)}`}>
              <span className="text-muted-foreground">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
              <span className="text-muted-foreground">{log.type.toUpperCase()}:</span> {log.message}
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
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Log</CardTitle>
        <CardDescription>Recent bookings and payment status</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2">
                <th className="p-3 text-left font-semibold">ID</th>
                <th className="p-3 text-left font-semibold">Amount</th>
                <th className="p-3 text-left font-semibold">Method</th>
                <th className="p-3 text-left font-semibold">Status</th>
                <th className="p-3 text-left font-semibold">Test</th>
                <th className="p-3 text-left font-semibold">Created</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="p-3 font-mono text-xs">{p.id.slice(0, 8)}</td>
                  <td className="p-3 font-semibold">HK${p.total_price}</td>
                  <td className="p-3">{p.payment_method}</td>
                  <td className="p-3">
                    <Badge variant={p.payment_status === 'completed' ? 'default' : 'secondary'}>
                      {p.payment_status}
                    </Badge>
                  </td>
                  <td className="p-3">{p.is_test ? '✓ Test' : ''}</td>
                  <td className="p-3 text-xs">{new Date(p.created_at).toLocaleString()}</td>
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
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth Log</CardTitle>
        <CardDescription>Authentication and authorization events</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2">
                <th className="p-3 text-left font-semibold">Timestamp</th>
                <th className="p-3 text-left font-semibold">User</th>
                <th className="p-3 text-left font-semibold">Action</th>
                <th className="p-3 text-left font-semibold">Details</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="p-3 text-xs">{new Date(e.created_at).toLocaleString()}</td>
                  <td className="p-3 font-mono text-xs">{e.user_id.slice(0, 8)}</td>
                  <td className="p-3 font-semibold">{e.action}</td>
                  <td className="p-3 text-xs font-mono">{JSON.stringify(e.details).slice(0, 60)}</td>
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
      }
    } finally {
      setLoading(false)
    }
  }

  async function addIp() {
    if (!newIp.trim()) return
    const res = await fetch('/api/dev2/ip-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: newIp.trim() }),
    })
    if (res.ok) {
      setNewIp('')
      await fetchData()
    }
  }

  async function confirmRemoveIp() {
    await fetch('/api/dev2/ip-whitelist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: ipToRemove }),
    })
    setShowRemoveDialog(false)
    setIpToRemove('')
    await fetchData()
  }

  async function approveIp(ip: string) {
    const label = prompt(`Approve ${ip}. Optional label:`)
    if (label === null) return
    await fetch('/api/dev2/ip-whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, label }),
    })
    await fetchData()
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Add IP Address</CardTitle>
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

        <Card>
          <CardHeader>
            <CardTitle>Whitelisted ({whitelist.length})</CardTitle>
            <CardDescription>Currently approved IP addresses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {whitelist.map((w) => (
                <div key={w.ip_address} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <div className="font-mono font-semibold">{w.ip_address}</div>
                    {w.label && <div className="text-sm text-muted-foreground">{w.label}</div>}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setIpToRemove(w.ip_address)
                      setShowRemoveDialog(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Requests ({pending.length})</CardTitle>
            <CardDescription>Blocked access attempts awaiting approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.ip} className="flex items-center justify-between p-3 bg-muted rounded-lg gap-4">
                  <div className="flex-1">
                    <div className="font-mono font-semibold">{p.ip}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.count} attempts · Last: {new Date(p.lastSeen).toLocaleString()}
                    </div>
                    {p.userAgent && (
                      <div className="text-xs text-muted-foreground mt-1">{p.userAgent.slice(0, 80)}</div>
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
            <AlertDialogAction onClick={confirmRemoveIp} className="bg-destructive text-destructive-foreground">
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
      }
    } finally {
      setLoading(false)
    }
  }

  async function executePush(enableGate: boolean) {
    const res = await fetch('/api/dev2/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enableGate }),
    })
    const json = await res.json()
    if (res.ok) {
      alert(`✅ ${json.message}`)
      await fetchStatus()
    } else {
      alert(`❌ ${json.error}`)
    }
    setShowPushDialog(false)
    setShowMaintenanceDialog(false)
    setShowGoLiveDialog(false)
    setConfirmation('')
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
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
        <Card>
          <CardHeader>
            <CardTitle>Branch Status</CardTitle>
            <CardDescription>Current deployment state</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="text-sm text-muted-foreground mb-1">UAT Branch</div>
                <div className="font-mono text-xs bg-muted p-2 rounded">
                  {status.uatSha.slice(0, 7)} — {status.uatMessage}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Main Branch</div>
                <div className="font-mono text-xs bg-muted p-2 rounded">
                  {status.mainSha.slice(0, 7)} — {status.mainMessage}
                </div>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm">UAT ahead of main</span>
              {isDiverged ? (
                <Badge variant="secondary" className="font-mono">
                  +{status.uatAhead} commits
                </Badge>
              ) : (
                <Badge variant="default">In sync</Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Site Gate</span>
              <Badge variant={status.gateEnabled ? 'destructive' : 'default'}>
                {status.gateEnabled ? '🔒 Enabled' : '🟢 Open'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deployment Actions</CardTitle>
            <CardDescription>Merge and deploy operations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="default"
              className="w-full justify-start"
              onClick={() => setShowPushDialog(true)}
              disabled={!isDiverged}
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Push to Production (gate unchanged)
            </Button>
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={() => setShowMaintenanceDialog(true)}
              disabled={!isDiverged}
            >
              <ShieldAlert className="h-4 w-4 mr-2" />
              Push + Enable Maintenance Mode
            </Button>
            {status.gateEnabled && (
              <Button variant="default" className="w-full justify-start" onClick={() => setShowGoLiveDialog(true)}>
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
              <strong>{status.gateEnabled ? 'ENABLED' : 'OPEN'}</strong>.
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
            <AlertDialogAction disabled={confirmation !== 'PUSH'} onClick={() => executePush(status.gateEnabled)}>
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
              disabled={confirmation !== 'PUSH'}
              onClick={() => executePush(true)}
              className="bg-destructive text-destructive-foreground"
            >
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
            <AlertDialogAction disabled={confirmation !== 'GO LIVE'} onClick={() => executePush(false)}>
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
        alert('✅ Test price updated')
        setAmount('')
        setLabel('')
      } else {
        const json = await res.json()
        alert(`❌ ${json.error}`)
      }
    } finally {
      setLoading(false)
      setShowConfirmDialog(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>UAT Test Pricing</CardTitle>
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
            <AlertDialogAction onClick={confirmSubmit}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
