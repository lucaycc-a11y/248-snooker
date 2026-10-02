export function EntryIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M24 12H12C9.79086 12 8 13.7909 8 16V48C8 50.2091 9.79086 52 12 52H24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 12H52C54.2091 12 56 13.7909 56 16V48C56 50.2091 54.2091 52 52 52H40"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 32H24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M35 27L40 32L35 37"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="26"
        y="22"
        width="12"
        height="20"
        rx="2"
        stroke="currentColor"
        strokeWidth="2.5"
      />
    </svg>
  )
}
