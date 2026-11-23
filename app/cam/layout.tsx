import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'SPACE8 錄影',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function CamLayout({ children }: { children: React.ReactNode }) {
  return children
}
