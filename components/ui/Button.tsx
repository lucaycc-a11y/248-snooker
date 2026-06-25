'use client'

import { forwardRef } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { tokens } from '@/app/styles/tokens'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'link'
type ButtonSize = 'sm' | 'md' | 'lg'

type ButtonProps = {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
  disabled?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>

const sizeMap: Record<ButtonSize, { height: string; padding: string; fontSize: string }> = {
  sm: { height: '40px', padding: '0 16px', fontSize: '14px' },
  md: { height: '52px', padding: '0 24px', fontSize: '16px' },
  lg: { height: '56px', padding: '0 32px', fontSize: '17px' },
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const s = sizeMap[size]
    const isDisabled = disabled || loading

    const baseStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      height: s.height,
      padding: s.padding,
      fontSize: s.fontSize,
      fontWeight: variant === 'primary' ? 700 : 500,
      fontFamily: tokens.font.sans,
      borderRadius: variant === 'link' ? '0' : tokens.radius.button,
      border: 'none',
      cursor: isDisabled ? 'not-allowed' : 'pointer',
      transition: `all ${tokens.duration.fast} ${tokens.easing.standard}`,
      width: fullWidth ? '100%' : 'auto',
      textDecoration: 'none',
      whiteSpace: 'nowrap',
      userSelect: 'none',
      WebkitTapHighlightColor: 'transparent',
      ...style,
    }

    if (variant === 'primary') {
      baseStyle.backgroundColor = isDisabled ? tokens.colors.brandDim : tokens.colors.brand
      baseStyle.color = isDisabled ? 'rgba(0,0,0,0.5)' : tokens.colors.brandText
    } else if (variant === 'secondary') {
      baseStyle.backgroundColor = 'transparent'
      baseStyle.color = tokens.colors.text
      baseStyle.border = `1px solid ${tokens.colors.borderStrong}`
    } else if (variant === 'ghost') {
      baseStyle.backgroundColor = 'transparent'
      baseStyle.color = tokens.colors.textMuted
    } else if (variant === 'link') {
      baseStyle.backgroundColor = 'transparent'
      baseStyle.color = tokens.colors.link
      baseStyle.padding = '0'
      baseStyle.height = 'auto'
    }

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        style={baseStyle}
        onPointerDown={(e) => {
          if (!isDisabled) {
            const el = e.currentTarget
            el.style.transform = 'scale(0.97)'
          }
        }}
        onPointerUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && variant === 'primary') {
            e.currentTarget.style.backgroundColor = tokens.colors.brandHover
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && variant === 'primary') {
            e.currentTarget.style.backgroundColor = tokens.colors.brand
          }
        }}
        {...props}
      >
        {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : leftIcon}
        <span>{children}</span>
        {variant === 'link' && !rightIcon ? <ChevronRight size={16} /> : rightIcon}
      </button>
    )
  }
)

Button.displayName = 'Button'
