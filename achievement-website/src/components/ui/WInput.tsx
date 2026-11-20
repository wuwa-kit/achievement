import type { ComponentProps } from 'react'

export type WInputProps = ComponentProps<'input'> & {
  variant?: 'default' | 'embedded'
}

const inputClass =
  'w-input min-w-0 text-[14px] leading-5 focus:outline-none forced-colors:focus:[outline:2px_solid_Highlight] forced-colors:focus:outline-offset-2'
const defaultInputClass =
  'h-9 rounded-md border border-(--input-border) bg-(--color-surface) px-3 py-0 text-inherit placeholder:text-(--color-muted) [&:hover:not(:disabled):not(:read-only):not(:focus):not([data-invalid=true])]:border-(--color-border-strong) focus:border-(--input-focus) focus:shadow-[0_0_0_3px_var(--input-focus-ring)] disabled:cursor-not-allowed disabled:bg-(--color-surface-soft) disabled:opacity-55 [&:read-only:not(:disabled)]:bg-(--color-surface-soft) data-[invalid=true]:border-(--color-danger) data-[invalid=true]:[--input-focus:var(--color-danger)] data-[invalid=true]:[--input-focus-ring:color-mix(in_srgb,var(--color-danger)_22%,transparent)] motion-safe:w-transition-colors'

export function WInput({
  variant = 'default',
  className = '',
  type = 'text',
  ...props
}: WInputProps) {
  const styled = type !== 'file' && type !== 'hidden'
  return (
    <input
      {...props}
      type={type}
      className={
        styled
          ? `${inputClass} ${variant === 'default' ? defaultInputClass : 'h-full'} ${className}`
          : className
      }
      data-variant={styled ? variant : undefined}
    />
  )
}
