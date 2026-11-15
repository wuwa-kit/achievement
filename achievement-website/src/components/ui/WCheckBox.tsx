import type { ComponentProps, ReactNode } from 'react'
import { WSvg } from './WSvg'

export type WCheckBoxProps = Omit<ComponentProps<'input'>, 'type' | 'children' | 'onChange'> & {
  children?: ReactNode
  onCheckedChange?: (checked: boolean) => void
}

export function WCheckBox({
  children,
  className = '',
  disabled,
  onCheckedChange,
  ...props
}: WCheckBoxProps) {
  return (
    <label
      className={`w-checkbox inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-[var(--checkbox-px,8px)] py-[7px] text-[length:var(--checkbox-text,12px)] [&:hover:not([data-disabled=true])]:bg-(--color-surface-soft) data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-55 motion-safe:w-transition-colors ${className}`}
      data-disabled={disabled}
    >
      <span className="relative grid size-4 flex-none place-items-center">
        <input
          {...props}
          className="w-checkbox-input peer absolute inset-0 size-full appearance-none rounded-[3px] [cursor:inherit] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus) forced-colors:appearance-auto"
          type="checkbox"
          disabled={disabled}
          onChange={(event) => onCheckedChange?.(event.currentTarget.checked)}
        />
        <span className="pointer-events-none absolute inset-0 rounded-[3px] border border-(--color-border-strong) bg-(--color-surface) peer-[:is(:checked,:indeterminate)]:border-(--color-accent) peer-[:is(:checked,:indeterminate)]:bg-(--color-accent) motion-safe:w-transition-colors forced-colors:hidden" />
        <WSvg
          name="check"
          size={14}
          className="pointer-events-none relative col-start-1 row-start-1 scale-75 text-(--color-on-accent) opacity-0 peer-[:checked:not(:indeterminate)]:scale-100 peer-[:checked:not(:indeterminate)]:opacity-100 motion-safe:transition-[opacity,scale] forced-colors:hidden"
        />
        <span className="pointer-events-none relative col-start-1 row-start-1 h-0.5 w-2 scale-x-75 rounded-full bg-(--color-on-accent) opacity-0 peer-indeterminate:scale-x-100 peer-indeterminate:opacity-100 motion-safe:transition-[opacity,scale] forced-colors:hidden" />
      </span>
      {children != null && <span className="w-checkbox-label">{children}</span>}
    </label>
  )
}
