'use client'

import { useState, useEffect } from 'react'
import { Settings, User, Shield, FileText, type LucideIcon } from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// BottomLinks — Settings / Manage Account / Safety / Legal + version
// ════════════════════════════════════════════════════════════════════════════

export function BottomLinks() {
  const [version, setVersion] = useState<string>('')

  useEffect(() => {
    loadVersion()
  }, [])

  const loadVersion = async () => {
    try {
      const res = await fetch('/api/version')
      if (res.ok) {
        const data = await res.json()
        setVersion(data.version || '')
      }
    } catch {
      setVersion('1.0.0')
    }
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Primary Links */}
      <div className="space-y-2">
        <BottomLink href="/member/settings" icon={Settings} title="Settings" subtitle="帳戶設定" />
        <BottomLink href="/member/manage" icon={User} title="Manage Account" subtitle="管理帳戶" />
        <BottomLink href="/member/safety" icon={Shield} title="Safety" subtitle="安全守則" />
        <BottomLink href="/member/legal" icon={FileText} title="Legal" subtitle="法律條款" />
      </div>

      {/* Version */}
      {version && (
        <div className="text-center">
          <p className="text-xs text-white/30">版本 {version}</p>
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § BOTTOM LINK
// ────────────────────────────────────────────────────────────────────────────

type BottomLinkProps = {
  href: string
  icon: LucideIcon
  title: string
  subtitle: string
}

function BottomLink({ href, icon: Icon, title, subtitle }: BottomLinkProps) {
  return (
    <a
      href={href}
      className="group flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-white/5 to-transparent p-4 transition-all hover:border-white/20 hover:from-white/10"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
          <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <p className="font-medium text-white">{title}</p>
          <p className="text-xs text-white/50">{subtitle}</p>
        </div>
      </div>
      <svg
        className="h-5 w-5 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-white/60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </a>
  )
}
