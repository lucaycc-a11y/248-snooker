/**
 * Loading indicator using the branded loading.gif animation.
 * Per user instruction, ALL loading states site-wide now use this GIF at
 * 120-160px size (even inline indicators), replacing the previous Space8Loader
 * spinning icon and Spinner component.
 *
 * ⚠️ Note: The GIF file is 4.9MB. Using it for small inline indicators
 * (e.g. "Thinking..." text, chat widget, button states) will:
 * - Load 4.9MB per indicator instance
 * - Force 120-160px display size in contexts that previously used 18-32px,
 *   potentially breaking layout/causing reflow
 *
 * This implementation follows the user's explicit choice to enforce 120-160px
 * across ALL loading states.
 */
export function LoadingGif({ size = 140 }: { size?: number }) {
  // Clamp to the user-specified 120-160px range
  const clampedSize = Math.max(120, Math.min(160, size))

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        width: clampedSize,
        height: clampedSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/video/Loading/loading.gif"
        alt=""
        width={clampedSize}
        height={clampedSize}
        // The GIF's canvas is opaque black (no alpha channel) — screen blending
        // makes its black pixels transparent against any backdrop, so it only
        // ever paints its bright animation content instead of a visible black
        // square on non-black containers (gray tooltips, glass panels, etc.).
        style={{ width: clampedSize, height: clampedSize, objectFit: 'contain', mixBlendMode: 'screen' }}
      />
    </div>
  )
}
