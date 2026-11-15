import { WOption, type WOptionProps } from './WOption'
import { WSelectContext } from './WSelect.context'
import { WSvg } from './WSvg'
import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { WButton } from './WButton'
import { WPopover, type WPopoverPlacement } from './WPopover'
import { WScrollArea } from './WScrollArea'

type OptionProps = WOptionProps
export type WSelectProps = Omit<ComponentProps<'button'>, 'value' | 'onChange' | 'children'> & {
  triggerContent?: ReactNode
  placement?: WPopoverPlacement
  offset?: number
  matchPopoverWidth?: boolean
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  name?: string
}
function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      isValidElement<{ children?: ReactNode }>(child)
        ? textOf(child.props.children)
        : String(child),
    )
    .join('')
}
export function WSelect({
  value,
  onValueChange,
  triggerContent,
  placement = 'bottom-start',
  offset = 6,
  matchPopoverWidth = false,
  children,
  disabled,
  className = '',
  name,
  ref: forwardedRef,
  onKeyDown,
  onClick,
  ...props
}: WSelectProps) {
  const options = Children.toArray(children)
    .filter(isValidElement<OptionProps>)
    .filter((child) => child.type === WOption)
    .map((child) => ({ ...child.props, text: textOf(child.props.children) }))
  const selected = options.findIndex((option) => option.value === value)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(selected)
  const anchorRef = useRef<HTMLButtonElement>(null)
  useImperativeHandle(forwardedRef, () => anchorRef.current!, [])
  const id = useId()
  const search = useRef({ text: '', time: 0 })
  const enabled = options
    .map((option, index) => (!option.disabled ? index : -1))
    .filter((index) => index >= 0)
  function show(last = false) {
    if (disabled || !enabled.length) return
    setActive(
      selected >= 0 && !options[selected].disabled ? selected : last ? enabled.at(-1)! : enabled[0],
    )
    setOpen(true)
  }
  function choose(index: number) {
    const option = options[index]
    if (!option || option.disabled) return
    onValueChange(option.value)
    setOpen(false)
    anchorRef.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])
  return (
    <>
      <WButton
        {...props}
        ref={anchorRef}
        className={`w-select group/select inline-flex min-w-0 items-center [justify-content:var(--select-justify,space-between)] gap-[var(--select-gap,10px)] rounded-md border border-(--color-border) bg-(--color-surface) px-[var(--select-px,12px)] py-[var(--select-py,9px)] text-start text-[13px] text-(--color-text) enabled:hover:border-(--color-border-strong) enabled:hover:bg-(--color-surface-hover) data-[expanded=true]:border-(--color-border-strong) data-[expanded=true]:bg-(--color-surface-hover) ${className}`}
        disabled={disabled}

        data-value={value}

        data-expanded={open}

        onClick={(event) => {
          onClick?.(event)
          if (!event.defaultPrevented) {
            if (open) setOpen(false)
            else show()
          }
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event)
          if (event.defaultPrevented || disabled) return
          if (event.key === 'Tab') {
            setOpen(false)
            return
          }
          if (event.key === 'Escape') {
            if (open) {
              event.preventDefault()
              setOpen(false)
            }
            return
          }
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (open) choose(active)
            else show()
            return
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            if (!open) show(event.key === 'ArrowUp' || event.key === 'End')
            else if (enabled.length) {
              const position = enabled.indexOf(active)
              setActive(
                event.key === 'Home'
                  ? enabled[0]
                  : event.key === 'End'
                    ? enabled.at(-1)!
                    : enabled[
                        (position + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) %
                          enabled.length
                      ],
              )
            }
            return
          }
          if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            const now = Date.now()
            search.current.text =
              (now - search.current.time < 700 ? search.current.text : '') +
              event.key.toLocaleLowerCase()
            search.current.time = now
            const query = search.current.text
            const match = enabled.find((index) =>
              options[index].text.toLocaleLowerCase().startsWith(query),
            )
            if (match !== undefined) {
              setActive(match)
              setOpen(true)
            }
          }
        }}
      >
        {triggerContent ?? (
          <>
            <span className="w-select-value truncate">{options[selected]?.children ?? ''}</span>
            <WSvg
              name="chevron-down"
              className="w-select-chevron shrink-0 transition-transform duration-160 ease-[ease] group-data-[expanded=true]/select:rotate-180 motion-reduce:transition-none"
              size={14}
            />
          </>
        )}
      </WButton>
      {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      <WPopover
        placement={placement}
        offset={offset}
        matchTriggerWidth={matchPopoverWidth}
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        className="w-select-popover"
      >
        <WScrollArea
          id={id}

          className="w-select-options max-h-[min(280px,calc(var(--w-popover-height,280px)-2px))] overflow-auto p-1 [&>button+button]:mt-1"
        >
          <WSelectContext.Provider
            value={{
              value,
              activeValue: options[active]?.value,
              optionId: (optionValue) =>
                id + '-' + options.findIndex((option) => option.value === optionValue),
              selectValue: (optionValue) =>
                choose(options.findIndex((option) => option.value === optionValue)),
              activateValue: (optionValue) =>
                setActive(options.findIndex((option) => option.value === optionValue)),
            }}
          >
            {children}
          </WSelectContext.Provider>
        </WScrollArea>
      </WPopover>
    </>
  )
}
