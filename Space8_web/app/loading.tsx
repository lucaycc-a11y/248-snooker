import { LoadingGif } from '@/components/ui'

/** Next.js route-transition loading UI — full-screen black overlay with the
 * branded loading GIF. */
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
      <LoadingGif size={140} />
    </div>
  )
}
