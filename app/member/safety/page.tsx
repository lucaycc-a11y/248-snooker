'use client'

import {
  Building2,
  Users,
  Baby,
  CigaretteOff,
  PawPrint,
  ShoppingBag,
  Camera,
  Video,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

// ════════════════════════════════════════════════════════════════════════════
// Safety Page — Venue safety rules from 場地使用守則及條款
// All content verified from official legal documents
// ════════════════════════════════════════════════════════════════════════════

export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05070C] via-[#0A0D12] to-[#0F131C]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#0A0D12]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <div className="flex items-center justify-between">
            <a href="/member" className="text-white/60 transition-colors hover:text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </a>
            <h1 className="text-lg font-medium text-white">Safety</h1>
            <div className="w-6" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="space-y-6">
          {/* Intro */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
            <h2 className="mb-3 text-xl font-bold text-white">場地使用守則</h2>
            <p className="text-sm text-white/60">
              以下規則源自《場地使用守則及條款》，保障所有會員的安全及使用體驗。
            </p>
          </section>

          {/* Self-service nature */}
          <SafetyCard
            icon={Building2}
            title="全自助式營運"
            description="場內並無常駐職員或保安人員；會員須自行承擔注意義務與安全責任。"
          />

          {/* Room capacity */}
          <SafetyCard
            icon={Users}
            title="房間人數上限"
            description="每間桌球室使用人數上限 8 人。"
          />

          {/* Minors supervision */}
          <SafetyCard
            icon={Baby}
            title="未成年人士"
            description="未滿 12 歲人士須由 18 歲以上成人全程陪同。"
          />

          {/* No smoking */}
          <SafetyCard
            icon={CigaretteOff}
            title="全面禁煙"
            description="場內全面禁煙（包括電子煙、加熱煙）。"
          />

          {/* No pets */}
          <SafetyCard
            icon={PawPrint}
            title="禁止攜帶寵物"
            description="除導盲犬外禁止攜帶寵物。"
          />

          {/* Personal belongings */}
          <SafetyCard
            icon={ShoppingBag}
            title="財物保管"
            description="財物須自行看護，本公司對財物遺失、盜竊、損壞概不負責。"
          />

          {/* Damage reporting */}
          <SafetyCard
            icon={Camera}
            title="損壞回報"
            description="進場後 10 分鐘內須透過 WhatsApp 拍照回報既有損壞，否則視為進場時完好。"
          />

          {/* CCTV */}
          <SafetyCard
            icon={Video}
            title="24 小時監控"
            description="24 小時 CCTV 監控，進入場地即視為同意收集及在合理範圍內使用相關錄像。"
          />

          {/* Service interruption */}
          <SafetyCard
            icon={AlertTriangle}
            title="服務中斷"
            description="服務中斷（斷電、政府命令、網絡故障、不可抗力）：本公司不負責間接損失，但會盡力安排補償或退款。"
          />

          {/* Contact */}
          <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
            <h2 className="mb-3 text-lg font-bold text-white">聯絡我們</h2>
            <div className="space-y-2 text-sm text-white/80">
              <p>
                <strong>WhatsApp:</strong>{' '}
                <a
                  href="https://wa.me/85261808022"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#22c55e] underline"
                >
                  +852 6180 8022
                </a>
              </p>
              <p>
                <strong>電郵:</strong>{' '}
                <a href="mailto:Info@space8.com.hk" className="text-[#22c55e] underline">
                  Info@space8.com.hk
                </a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// § SAFETY CARD
// ────────────────────────────────────────────────────────────────────────────

type SafetyCardProps = {
  icon: LucideIcon
  title: string
  description: string
}

function SafetyCard({ icon: Icon, title, description }: SafetyCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
          <Icon className="h-6 w-6 text-white" strokeWidth={1.5} />
        </div>
        <div>
          <h3 className="font-bold text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/70">{description}</p>
        </div>
      </div>
    </div>
  )
}
