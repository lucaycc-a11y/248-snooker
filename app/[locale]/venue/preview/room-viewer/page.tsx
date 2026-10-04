import { RoomViewer } from '@/components/ui/RoomViewer'
import type { RoomId } from '@/lib/data/venue-rooms'

interface PageProps {
  searchParams: Promise<{ room?: string }>
}

export default async function RoomViewerPreviewPage({ searchParams }: PageProps) {
  const params = await searchParams
  const room = (params.room as RoomId) ?? undefined

  return (
    <div className="min-h-screen">
      <RoomViewer initialRoom={room} />

      {/* Preview controls */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 gap-2 rounded-full bg-black/80 p-2 backdrop-blur-lg">
        <a
          href="?room=infinity"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Snap to Infinity
        </a>
        <a
          href="?room=eternity"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Snap to Eternity
        </a>
        <a
          href="/zh-HK/venue/preview/room-viewer"
          className="rounded-full bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
        >
          Reset (50/50)
        </a>
      </div>
    </div>
  )
}
