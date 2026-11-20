import { WButton, type WButtonProps } from './WButton'

const iconButtonSizeClass =
  'inline-grid size-9 shrink-0 place-items-center rounded-md [&>svg]:size-5'
export const iconButtonClass = `${iconButtonSizeClass} border border-(--color-border) bg-(--color-surface) [&:hover:not(:disabled)]:bg-(--color-surface-soft)`

export type WIconButtonProps = WButtonProps & { variant?: 'default' | 'ghost' }

export function WIconButton({ variant = 'default', className = '', ...props }: WIconButtonProps) {
  return (
    <WButton
      {...props}
      className={`${variant === 'ghost' ? `${iconButtonSizeClass} enabled:hover:bg-(--color-surface-soft)` : iconButtonClass} ${className}`}
    />
  )
}
