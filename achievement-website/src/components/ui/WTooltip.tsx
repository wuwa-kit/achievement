import { cloneElement, useEffect, useRef, useState, type ReactElement, type Ref } from 'react'
import { WPopover, type WPopoverPlacement } from './WPopover'
type TargetProps = {
  ref?: Ref<HTMLElement>
  onPointerEnter?: (event: React.PointerEvent<HTMLElement>) => void
  onPointerLeave?: (event: React.PointerEvent<HTMLElement>) => void
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLElement>) => void
  onBlur?: (event: React.FocusEvent<HTMLElement>) => void
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  onKeyDown?: (event: React.KeyboardEvent<HTMLElement>) => void
}
export type WTooltipProps = {
  text?: string
  children: ReactElement<TargetProps>
  placement?: WPopoverPlacement
  delay?: number
}
export function WTooltip({ text = '', children, placement = 'top', delay = 300 }: WTooltipProps) {
  const anchorRef = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [open, setOpen] = useState(false)
  function hide() {
    clearTimeout(timer.current)
    setOpen(false)
  }
  function show() {
    clearTimeout(timer.current)
    if (text.trim())
      timer.current = setTimeout(() => {
        if (anchorRef.current?.dataset.expanded !== 'true') setOpen(true)
      }, delay)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const original = children.props
  return (
    <>
      {cloneElement(children, {
        ref: (element) => {
          anchorRef.current = element
          if (typeof original.ref === 'function') return original.ref(element)
          if (original.ref) original.ref.current = element
        },
        onPointerEnter: (event) => {
          original.onPointerEnter?.(event)
          show()
        },
        onPointerLeave: (event) => {
          original.onPointerLeave?.(event)
          hide()
        },
        onPointerDown: (event) => {
          original.onPointerDown?.(event)
          hide()
        },
        onFocus: (event) => {
          original.onFocus?.(event)
          if (event.currentTarget.matches(':focus-visible')) show()
        },
        onBlur: (event) => {
          original.onBlur?.(event)
          hide()
        },
        onClick: (event) => {
          original.onClick?.(event)
          hide()
        },
        onKeyDown: (event) => {
          original.onKeyDown?.(event)
          if (event.key === 'Escape') hide()
        },
      })}
      <WPopover
        open={open && !!text.trim()}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        placement={placement}
        offset={8}
        className="w-tooltip pointer-events-none text-[12px] leading-normal wrap-anywhere whitespace-pre-wrap [--popover-bg:var(--color-accent)] [--popover-border-width:0px] [--popover-padding:7px_10px] [--popover-text:var(--color-on-accent)]"
      >
        {text}
      </WPopover>
    </>
  )
}
