import { useContext, type ReactNode } from 'react'
import { WSelectContext } from './WSelect.context'
import { WSvg } from './WSvg'
import { WButton } from './WButton'
export type WOptionProps = { value: string; disabled?: boolean; indicator?: ReactNode; children: ReactNode }
export function WOption({ value, disabled = false, indicator, children }: WOptionProps) {
  const context = useContext(WSelectContext)
  if (!context) throw new Error('WOption must be inside WSelect')
  const selected = Object.is(context.value, value)
  return (
    <WButton
      type="button"
      id={context.optionId(value)}

      disabled={disabled}
      data-selected={selected}
      data-disabled={disabled || undefined}
      data-value={value}
      data-active={context.activeValue === value || undefined}
      className="w-select-option grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_14px] items-center gap-2.5 rounded-sm px-3 py-1.5 text-start text-[14px] leading-5 text-inherit select-none data-[selected=true]:bg-(--color-selection) data-active:bg-(--color-surface-hover) data-active:data-[selected=true]:bg-(--color-selection) data-active:outline data-active:outline-offset-[-1px] data-active:outline-(--color-focus) data-disabled:cursor-default data-disabled:opacity-40"
      onPointerMove={() => {
        if (!disabled) context.activateValue(value)
      }}
      onPointerDown={(event) => event.preventDefault()}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!disabled) context.selectValue(value)
      }}
    >
      <span className="wrap-anywhere">{children}{indicator}</span>
      {selected && <WSvg name="check" size={14} />}
    </WButton>
  )
}
