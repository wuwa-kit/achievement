import type { ComponentProps } from 'react'
export type WButtonProps = ComponentProps<'button'> & { loading?: boolean }
export function WButton({
  type = 'button',
  loading = false,
  disabled,
  className = '',
  ...props
}: WButtonProps) {
  return (
    <button
      type={type}
      {...props}
      disabled={disabled || loading}
      className={`cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 motion-safe:[transition:var(--w-color-transition),transform_var(--w-color-transition-duration)_ease] ${className}`}
    />
  )
}
