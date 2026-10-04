import { RoomViewer } from '@/components/ui/RoomViewer'
import type { RoomId } from '@/lib/data/venue-rooms'

interface PageProps {
  searchParams: Promise<{ room?: string; theme?: string }>
}

export default async function RoomViewerPreviewPage({ searchParams }: PageProps) {
  const params = await searchParams
  const room = (params.room as RoomId) ?? 'infinity'
  const theme = (params.theme === 'light' ? 'light' : 'dark') as 'dark' | 'light'

  return (
    <div className="min-h-screen">
      <RoomViewer theme={theme} initialRoom={room} />

      {/* Preview controls */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-2 rounded-full bg-black/80 p-2 backdrop-blur-lg">
        <a
          href="?theme=dark&room=infinity"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Dark / Infinity
        </a>
        <a
          href="?theme=dark&room=eternity"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Dark / Eternity
        </a>
        <a
          href="?theme=light&room=infinity"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Light / Infinity
        </a>
        <a
          href="?theme=light&room=eternity"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Light / Eternity
        </a>
      </div>
    </div>
  )
}
