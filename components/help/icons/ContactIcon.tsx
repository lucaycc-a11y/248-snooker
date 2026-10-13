export function ContactIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M52 40V48C52 50.2091 50.2091 52 48 52H16C13.7909 52 12 50.2091 12 48V16C12 13.7909 13.7909 12 16 12H24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M52 12L32 32L24 28L20 20L40 12L52 12Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M52 12V20"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="20"
        cy="44"
        r="2"
        fill="currentColor"
      />
      <circle
        cx="32"
        cy="44"
        r="2"
        fill="currentColor"
      />
      <circle
        cx="44"
        cy="44"
        r="2"
        fill="currentColor"
      />
    </svg>
  )
}
