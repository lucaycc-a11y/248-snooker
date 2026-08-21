// ────────────────────────────────────────────────────────────────
// Payment method badge icons.
// Every payment badge is served from the official asset set in
// /public/icons/payment/; no payment branding is recreated in JSX.
// ────────────────────────────────────────────────────────────────

import Image from "next/image"

type BadgeProps = {
  /** Height of the badge in px (width auto). Default 20. */
  height?: number
  className?: string
}

type ImgBadgeProps = BadgeProps & { src: string; alt: string; width?: number }

function ImgBadgeIcon({ height = 20, className, src, alt, width = 32 }: ImgBadgeProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={{ display: "block", width, height, objectFit: "contain" }}
    />
  )
}

// Card networks (CNP Hosted)
export function VisaBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cnp-visa.png" alt="Visa" />
}

export function MastercardBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cnp-mastercard.png" alt="Mastercard" />
}

export function UnionPayCNPBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cnp-unionpay.png" alt="UnionPay" />
}

export function JcbBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cnp-jcb.png" alt="JCB" />
}

export function DinersBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cnp-diners-club.png" alt="Diners Club" />
}

export function AmexBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cnp-amex.png" alt="American Express" />
}

// Wallets and direct-connect methods
export function GooglePayBadgeIcon({ height = 20, className }: BadgeProps) {
  const pillH = height + 6
  const pillW = Math.round((40 / 20) * height) + 8
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        borderRadius: pillH / 2,
        width: pillW,
        height: pillH,
        flexShrink: 0,
      }}
    >
      <ImgBadgeIcon height={height} className={className} src="/icons/payment/google.png" alt="Google Pay" width={40} />
    </span>
  )
}

export function ApplePayBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/apple.png" alt="Apple Pay" width={40} />
}

export function AlipayBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/alipaycn.png" alt="Alipay" />
}

export function AlipayHKBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/alipayhk.png" alt="AlipayHK" />
}

export function WeChatPayBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/wechat.png" alt="WeChat Pay" />
}

export function UnionPayQuickPassBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/cloud.png" alt="UnionPay QuickPass" />
}

export function PayMeBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/payme.png" alt="PayMe" />
}

export function FpsBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/fps.png" alt="FPS" />
}

export function OctopusBadgeIcon(props: BadgeProps) {
  return <ImgBadgeIcon {...props} src="/icons/payment/octopus-card.png" alt="Octopus" width={40} />
}
