// Shown while a page's server data loads, so navigation never leaves a blank screen.
export default function AdminLoading() {
  return (
    <div className="ad-skel-wrap" role="status" aria-live="polite" aria-label="載入中">
      <div className="ad-skel ad-skel-line" style={{ width: '38%' }} />
      <div className="ad-skel-row">
        <div className="ad-skel ad-skel-card" />
        <div className="ad-skel ad-skel-card" />
        <div className="ad-skel ad-skel-card" />
      </div>
      <div className="ad-skel ad-skel-block" />
      <div className="ad-skel ad-skel-block short" />
    </div>
  )
}
