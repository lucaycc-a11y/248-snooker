'use client'

import { useState } from 'react'

// ════════════════════════════════════════════════════════════════════════════
// Privacy & Data Tab — Links to 私隱政策, data request rights, communication prefs
// ════════════════════════════════════════════════════════════════════════════

export function PrivacyDataTab() {
  return (
    <div className="space-y-6">
      {/* Privacy Policy */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">私隱政策</h2>
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            我們重視你的私隱。閱讀我們的私隱政策，了解我們如何收集、使用及保護你的個人資料。
          </p>
          <a
            href="/legal/privacy"
            className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white transition-colors hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm">查看私隱政策</span>
              <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </a>
        </div>
      </section>

      {/* Data Rights */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">資料權利</h2>
        <div className="space-y-3">
          <p className="text-sm text-white/60">
            你有權閱覽、更正或刪除你的個人資料。如需行使這些權利，請透過以下方式聯絡我們：
          </p>
          <div className="rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-sm text-white">
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
            <p className="mt-2 text-sm text-white">
              <strong>電郵:</strong>{' '}
              <a href="mailto:Admin@space8.com.hk" className="text-[#22c55e] underline">
                Admin@space8.com.hk
              </a>
            </p>
            <p className="mt-3 text-xs text-white/40">
              我們會在 30 天內處理你的要求
            </p>
          </div>
        </div>
      </section>

      {/* Communication Preferences */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-6">
        <h2 className="mb-4 text-lg font-bold text-white">通訊設定</h2>
        <p className="text-sm text-white/60">
          管理你的通知偏好設定
        </p>
        <a
          href="/member/settings"
          className="mt-3 block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white transition-colors hover:bg-white/10"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm">前往設定</span>
            <svg className="h-5 w-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </a>
      </section>
    </div>
  )
}
