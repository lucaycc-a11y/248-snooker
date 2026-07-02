/**
 * Branded loading indicator: the Space8 ball icon rotating in place via pure
 * CSS (see .animate-space8-spin in globals.css) — no video/GIF/Lottie.
 * `theme="dark"` (white ball, for dark backgrounds) is the default since
 * most loading states on this site sit on a black background.
 */
export function Space8Loader({
  size = 32,
  theme = 'dark',
}: {
  size?: number
  theme?: 'dark' | 'light'
}) {
  const src =
    theme === 'dark'
      ? '/logos/Space8_ball_icon_white_black_bkg.svg'
      : '/logos/Space8_ball_icon_black_white_bkg.svg'

  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size }}
      className="animate-space8-spin"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed decorative icon at arbitrary caller-supplied sizes; next/image's overhead isn't warranted here */}
      <img src={src} alt="" width={size} height={size} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
