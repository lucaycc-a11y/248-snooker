/**
 * MemberIcons - SVG sprite component for member area icons
 *
 * This component renders a hidden SVG sprite that contains all icons used
 * in the member area (Wallet, Points, Inbox). Icons are referenced via
 * <use href="#i-{name}"/> in other components.
 *
 * Extracted from the approved design files: space-wallet.html, space-points.html, space-inbox.html
 */

export default function MemberIcons() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="i-back" viewBox="0 0 24 24">
          <path d="M15 5l-7 7 7 7" />
        </symbol>
        <symbol id="i-chev" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" />
        </symbol>
        <symbol id="i-wallet" viewBox="0 0 24 24">
          <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H6a1 1 0 0 0 0 2h14v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M16.5 14.5h.01" />
        </symbol>
        <symbol id="i-help" viewBox="0 0 24 24">
          <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
        </symbol>
        <symbol id="i-gem" viewBox="0 0 24 24">
          <path d="M6 3h12l4 6-10 12L2 9z" />
          <path d="M2 9h20M9 3l3 6 3-6" />
        </symbol>
        <symbol id="i-inbox" viewBox="0 0 24 24">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" />
          <path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" />
        </symbol>
        <symbol id="i-cal" viewBox="0 0 24 24">
          <path d="M7 3v3M17 3v3M4 9h16" />
          <path d="M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
        </symbol>
        <symbol id="i-gift" viewBox="0 0 24 24">
          <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13" />
          <path d="M12 7c-2.5 0-4-1-4-2.5S9.5 2.5 12 5c2.5-2.5 4-.5 4 .5S14.5 7 12 7z" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" />
        </symbol>
        <symbol id="i-return" viewBox="0 0 24 24">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
        </symbol>
        <symbol id="i-swap" viewBox="0 0 24 24">
          <path d="M7 7h12l-3-3M17 17H5l3 3" />
        </symbol>
        <symbol id="i-tag" viewBox="0 0 24 24">
          <path d="M3 12V4h8l10 10-8 8z" />
          <path d="M7.5 8.5h.01" />
        </symbol>
        <symbol id="i-sliders" viewBox="0 0 24 24">
          <path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2" />
          <path d="M14 4v4M8 10v4M16 16v4" />
        </symbol>
        <symbol id="i-alert" viewBox="0 0 24 24">
          <path d="M12 8v5M12 16.5h.01" />
          <path d="M10.3 3.9L2.4 17.5a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </symbol>
        <symbol id="i-copy" viewBox="0 0 24 24">
          <path d="M9 9h11v11H9z" />
          <path d="M5 15V4h10" />
        </symbol>
        <symbol id="i-refresh" viewBox="0 0 24 24">
          <path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3" />
          <path d="M5 4v4h4M19 20v-4h-4" />
        </symbol>
        <symbol id="i-history" viewBox="0 0 24 24">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 3v5h5M12 7v5l3 2" />
        </symbol>
        <symbol id="i-minus" viewBox="0 0 24 24">
          <path d="M5 12h14" />
        </symbol>
        <symbol id="i-spark" viewBox="0 0 24 24">
          <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
        </symbol>
        <symbol id="i-lock" viewBox="0 0 24 24">
          <path d="M6 11h12v9H6z" />
          <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
        </symbol>
      </defs>
    </svg>
  )
}
