// ────────────────────────────────────────────────────────────────
// Payment method badge icons — inline SVG, mirroring the approved
// black-theme demo (space8-payment-method-preview-black.html).
//
// Each badge is a small colored chip drawn entirely inline (no
// external image URLs — no loading delay / no broken fetches).
// Wordmarks use <text> inside SVG, exactly like the demo.
// ────────────────────────────────────────────────────────────────

type BadgeProps = {
  /** Height of the badge in px (width auto). Default 24. */
  height?: number
  className?: string
}

// Card schemes
export function VisaBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 48 22" className={className} aria-hidden>
      <rect width="48" height="22" rx="4" fill="#1434CB" />
      <text x="24" y="15" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontStyle="italic" fontSize="12" fill="#fff">VISA</text>
    </svg>
  )
}

export function MastercardBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 30 22" className={className} aria-hidden>
      <rect width="30" height="22" rx="4" fill="#fff" />
      <circle cx="11" cy="10" r="7" fill="#EB001B" />
      <circle cx="19" cy="10" r="7" fill="#F79E1B" />
      <path d="M15 4.5a7 7 0 0 1 0 11 7 7 0 0 1 0-11z" fill="#FF5F00" />
    </svg>
  )
}

// Wallet providers
export function GooglePayBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 60 22" className={className} aria-hidden>
      <rect width="60" height="22" rx="11" fill="#fff" />
      <circle cx="9" cy="11" r="6.5" fill="#4285F4" />
      <path d="M9 7.5v7M6.2 9l2.8-1.5L11.8 9" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <text x="20" y="14.5" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="11.5" fill="#3C4043">Pay</text>
    </svg>
  )
}

export function ApplePayBadgeIcon({ height = 24, className }: BadgeProps) {
  // Official Apple Pay wordmark (black chip, white  — visible on the
  // dark disabled card; matches components/brand/PaymentLogos ApplePayLogo).
  return (
    <svg height={height} viewBox="0 0 60 22" className={className} aria-hidden>
      <rect width="60" height="22" rx="4" fill="#000" />
      <path d="M13.5 6.9c.7-.9 1.2-2.1 1.1-3.3-1.1.1-2.4.7-3.1 1.6-.7.7-1.3 1.9-1.1 3.1 1.2.1 2.4-.6 3.1-1.4z" fill="#fff" />
      <path d="M14.9 9.1c-1.8-.1-3.3 1-4.2 1s-2.2-.9-3.6-.9c-1.8 0-3.5 1.1-4.5 2.7-1.9 3.3-.5 8.3 1.4 11 .9 1.4 2 2.9 3.5 2.8 1.4-.1 1.9-.9 3.6-.9s2.2.9 3.6.9c1.5-.1 2.5-1.4 3.4-2.7 1.1-1.6 1.5-3.1 1.5-3.2-.1 0-2.9-1.1-2.9-4.4-.1-2.7 2.2-4 2.3-4.2-1.3-1.9-3.3-2.1-4-2.1z" fill="#fff" />
      <text x="36" y="14.5" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="600" fontSize="11" fill="#fff">Pay</text>
    </svg>
  )
}

export function AlipayBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="5" fill="#1677FF" />
      <text x="12" y="17" textAnchor="middle" fontFamily="PingFang HK, 'Noto Sans TC', sans-serif" fontWeight="700" fontSize="14" fill="#fff">支</text>
    </svg>
  )
}

export function WeChatPayBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#07C160" />
      <path fill="#fff" d="M9.2 6.5c-2.9 0-5.3 2-5.3 4.5 0 1.4.8 2.6 2 3.5l-.5 1.5 1.7-.9c.6.2 1.3.3 2 .3h.2c-.1-.4-.2-.7-.2-1.1 0-2.8 2.7-5.1 6-5.1h.2c-.5-2.1-2.9-3.7-6.1-3.7zm-1.9 2.7c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7zm3.8 0c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7z" />
      <path fill="#fff" d="M20.1 14c0-2.1-2.1-3.8-4.7-3.8s-4.7 1.7-4.7 3.8 2.1 3.8 4.7 3.8c.5 0 1-.1 1.5-.2l1.5.8-.4-1.3c1.2-.7 2.1-1.8 2.1-3.1zm-6.3-.6c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6zm3.2 0c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6z" />
    </svg>
  )
}

export function UnionPayQuickPassBadgeIcon({ height = 24, className }: BadgeProps) {
  // 雲閃付 (UnionPay QuickPass) — red chip from the demo
  return (
    <svg height={height} viewBox="0 0 44 22" className={className} aria-hidden>
      <rect width="44" height="22" rx="4" fill="#E21836" />
      <text x="22" y="15" textAnchor="middle" fontFamily="PingFang HK, 'Noto Sans TC', sans-serif" fontWeight="800" fontSize="11" fill="#fff">云闪付</text>
    </svg>
  )
}

export function PayMeBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 52 22" className={className} aria-hidden>
      <rect width="52" height="22" rx="4" fill="#EA1E63" />
      <text x="26" y="15" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="11" fill="#fff">PayMe</text>
    </svg>
  )
}

export function FpsBadgeIcon({ height = 24, className }: BadgeProps) {
  return (
    <svg height={height} viewBox="0 0 40 22" className={className} aria-hidden>
      <rect width="40" height="22" rx="4" fill="#0B3D91" />
      <text x="20" y="15" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="11" fill="#fff">FPS</text>
    </svg>
  )
}