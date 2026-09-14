'use client'

import { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { X } from 'lucide-react'
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
  activeTestPrice: {
    mode: string
    amount: number
    label: string | null
  } | null
}

type Dev2PanelProps = {
  onClose?: () => void
}

export function Dev2Panel({ onClose }: Dev2PanelProps) {
  const [activeTab, setActiveTab] = useState('env')
  const [envInfo, setEnvInfo] = useState<EnvInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchEnvInfo()
  }, [])

  async function fetchEnvInfo() {
    try {
      const res = await fetch('/api/dev2/env-info')
      if (res.ok) {
        const data = await res.json()
        setEnvInfo(data)
      }
    } catch (err) {
      console.error('Failed to fetch env info:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>
        Loading dev2 panel...
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--admin-text)', marginBottom: 4 }}>
            Dev2 Panel · {formatVersion()}
          </h1>
          <p style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>
            UAT testing and deployment management
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: 8,
              background: 'transparent',
              border: '1px solid var(--admin-border)',
              borderRadius: 8,
              color: 'var(--admin-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="env">Env Info</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
          <TabsTrigger value="vercel">Vercel Logs</TabsTrigger>
          <TabsTrigger value="auth">Auth Log</TabsTrigger>
          <TabsTrigger value="payment">Payment Log</TabsTrigger>
          <TabsTrigger value="ip">IP Whitelist</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
          <TabsTrigger value="actions">Quick Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="env">
          <EnvInfoTab data={envInfo} />
        </TabsContent>

        <TabsContent value="activity">
          <ActivityLogTab />
        </TabsContent>

        <TabsContent value="vercel">
          <VercelLogsTab />
        </TabsContent>

        <TabsContent value="auth">
          <AuthLogTab />
        </TabsContent>

        <TabsContent value="payment">
          <PaymentLogTab />
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

// Re-export existing tab components from the page
function EnvInfoTab({ data }: { data: EnvInfo | null }) {
  if (!data) return <div>No data</div>

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <InfoRow label="Environment" value={data.env} />
      <InfoRow label="User" value={data.admin.email} />
      <InfoRow label="Role" value={data.admin.role} />
      <InfoRow label="IP Whitelisted" value={data.isIpWhitelisted ? 'Yes' : 'No'} />
      <InfoRow label="Gate Enabled" value={data.gateEnabled ? 'Yes' : 'No'} />
      <InfoRow
        label="Active Test Price"
        value={
          data.activeTestPrice
            ? `${data.activeTestPrice.mode} · HK$${data.activeTestPrice.amount} · ${data.activeTestPrice.label}`
            : 'None'
        }
      />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: 12,
        background: 'var(--admin-bg-secondary)',
        borderRadius: 8,
      }}
    >
      <span style={{ color: 'var(--admin-text-muted)', fontSize: 14 }}>{label}</span>
      <span style={{ color: 'var(--admin-text)', fontSize: 14, fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function ActivityLogTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>Activity log coming soon</div>
}

function VercelLogsTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>Vercel logs coming soon</div>
}

function AuthLogTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>Auth log coming soon</div>
}

function PaymentLogTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>Payment log coming soon</div>
}

function IpWhitelistTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>IP whitelist coming soon</div>
}

function DeployTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>Deploy tab coming soon</div>
}

function QuickActionsTab() {
  return <div style={{ padding: 24, color: 'var(--admin-text-muted)' }}>Quick actions coming soon</div>
}
