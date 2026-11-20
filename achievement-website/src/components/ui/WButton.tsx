import type { ComponentProps } from 'react'
export type WButtonProps = ComponentProps<'button'> & {
  loading?: boolean
  blurOnPointerClick?: boolean
}
export function WButton({
  type = 'button',
  loading = false,
  blurOnPointerClick = true,
  disabled,
  className = '',
  onClick,
  ...props
}: WButtonProps) {
  return (
    <button
      type={type}
      {...props}
      onClick={(event) => {
        if (blurOnPointerClick && event.detail > 0) event.currentTarget.blur()
        onClick?.(event)
      }}
      disabled={disabled || loading}
      className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 motion-safe:[transition:var(--w-color-transition),transform_var(--w-color-transition-duration)_ease] ${className}`}
    />
  )
}
