import { Space8Loader } from '@/components/ui'

/** Next.js route-transition loading UI — full-screen black overlay with the
 * branded Space8 ball spinning in place (see Space8Loader). */
export default function Loading() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <Space8Loader size={64} theme="dark" />
    </div>
  )
}
