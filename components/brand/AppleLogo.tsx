type AppleLogoProps = {
  size?: number
  color?: string
}

// Apple glyph in SF proportions. The path's true bounds are ~17 wide × ~23.2
// tall, so the viewBox is 0 0 17 24 (a 20-unit box would clip the lower lobe).
// `size` sets the height; width scales to preserve aspect ratio. `color` fills.
export function AppleLogo({ size = 20, color = '#000000' }: AppleLogoProps) {
  return (
    <svg
      width={(size * 17) / 24}
      height={size}
      viewBox="0 0 17 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.074 0c.072.89-.248 1.783-.77 2.442-.559.697-1.46 1.24-2.347 1.172-.096-.876.292-1.8.796-2.386C10.32.518 11.28.013 12.074 0zM15.539 6.944c-.172.094-2.756 1.586-2.729 4.745.03 3.767 3.302 5.025 3.337 5.038-.024.088-.512 1.754-1.697 3.454-.998 1.453-2.045 2.874-3.67 2.905-1.596.03-2.12-.945-3.955-.945-1.836 0-2.412.916-3.92.975C1.28 23.146.212 21.64.001 20.18c-.001-.007-.001-.013-.001-.02C-.12 17.75 1.26 14.87 2.65 13.15c.976-1.207 2.271-1.958 3.498-1.975 1.573-.021 2.57.959 3.866.959 1.26 0 2.027-.98 3.837-1.017.717-.015 2.73.247 4.02 2.132l-.332.695zM8.63 4.511c-.141-.006-.282-.006-.42.004.018-.138.043-.275.074-.41C8.702 2.72 9.621 1.49 10.636.88c-.186.545-.282 1.125-.266 1.71-.001 1.054-.662 1.879-1.74 1.921z"
        fill={color}
      />
    </svg>
  )
}
