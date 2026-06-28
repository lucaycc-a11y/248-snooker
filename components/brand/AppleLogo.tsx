type AppleLogoProps = {
  size?: number
  color?: string
}

// Official Apple glyph (viewBox 16×19). `size` sets the height; width scales to
// preserve aspect ratio. `color` fills the path. Used on white login buttons.
export function AppleLogo({ size = 19, color = '#000000' }: AppleLogoProps) {
  return (
    <svg
      width={(size * 16) / 19}
      height={size}
      viewBox="0 0 16 19"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        d="M13.173 10.137c-.022-2.557 2.09-3.793 2.185-3.852-1.19-1.74-3.045-1.979-3.7-2.003-1.575-.158-3.074.924-3.872.924-.797 0-2.024-.9-3.33-.876C2.74 4.356 1.2 5.023.403 6.198-1.24 8.6.062 12.17 1.64 14.12c.786 1.127 1.722 2.393 2.953 2.347 1.186-.047 1.634-.764 3.069-.764s1.838.764 3.092.74c1.278-.022 2.083-1.15 2.863-2.28.906-1.307 1.278-2.575 1.3-2.64-.03-.013-2.52-1.024-2.544-4.386zM10.718 2.726C11.39 1.914 11.85.8 11.714-.36c-.946.038-2.099.633-2.78 1.427-.609.706-1.147 1.848-1.003 2.936 1.057.082 2.138-.536 2.787-1.277z"
        fill={color}
      />
    </svg>
  )
}
