import { useLayoutEffect, useRef, type ComponentProps, type RefObject } from 'react'
import { useOverlayPresence } from './useOverlayPresence'
import './WPopover.css'

export type WPopoverPlacement =
  'top' | 'top-start' | 'top-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'right'

export type WPopoverProps = Omit<ComponentProps<'div'>, 'popover'> & {
  placement?: WPopoverPlacement
  offset?: number
  matchTriggerWidth?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  anchorRef: RefObject<HTMLElement | null>
}

export function WPopover({
  open,
  placement = 'bottom-start',
  offset = 6,
  matchTriggerWidth = false,
  onOpenChange,
  anchorRef,
  children,
  className = '',
  ...props
}: WPopoverProps) {
  const ref = useRef<HTMLDivElement>(null)
  const present = useOverlayPresence(open, ref)
  const change = useRef(onOpenChange)
  change.current = onOpenChange

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let positionFrame = 0
    const beforeToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') change.current(false)
    }
    element.addEventListener('beforetoggle', beforeToggle)
    const position = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const viewport = window.visualViewport
      const width = viewport?.width ?? innerWidth
      const height = viewport?.height ?? innerHeight
      const offsetX = viewport?.offsetLeft ?? 0
      const offsetY = viewport?.offsetTop ?? 0
      const padding = 8
      const below = height + offsetY - rect.bottom - offset - padding
      const above = rect.top - offsetY - offset - padding
      let side = placement.split('-')[0]
      if (side === 'bottom' && below < 240 && above > below) side = 'top'
      else if (side === 'top' && above < 240 && below > above) side = 'bottom'
      const available = side === 'top' ? above : side === 'bottom' ? below : height - padding * 2
      element.style.setProperty('--w-popover-height', Math.max(0, available) + 'px')
      element.style.width = matchTriggerWidth
        ? Math.min(rect.width, width - padding * 2) + 'px'
        : ''
      element.style.minWidth = Math.min(rect.width, width - padding * 2) + 'px'
      element.style.maxWidth = width - padding * 2 + 'px'
      let left = rect.left
      let top = side === 'top' ? rect.top - element.offsetHeight - offset : rect.bottom + offset
      if (side === 'left' || side === 'right') {
        left = side === 'left' ? rect.left - element.offsetWidth - offset : rect.right + offset
        top = rect.top + (rect.height - element.offsetHeight) / 2
      } else if (placement.endsWith('-end')) left = rect.right - element.offsetWidth
      else if (!placement.includes('-')) left = rect.left + (rect.width - element.offsetWidth) / 2
      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(value, Math.max(min, max)))
      element.style.left =
        clamp(left, offsetX + padding, offsetX + width - element.offsetWidth - padding) + 'px'
      element.style.top =
        clamp(top, offsetY + padding, offsetY + height - element.offsetHeight - padding) + 'px'
      element.dataset.side = side
    }
    if (open) {
      position()
      if (!element.matches(':popover-open'))
        element.showPopover({ source: anchorRef.current ?? undefined })
      position()
    } else if (element.matches(':popover-open')) element.hidePopover()
    const schedulePosition = () => {
      cancelAnimationFrame(positionFrame)
      positionFrame = requestAnimationFrame(position)
    }
    const observer = new ResizeObserver(schedulePosition)
    if (anchorRef.current) observer.observe(anchorRef.current)
    observer.observe(element)
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    window.visualViewport?.addEventListener('resize', position)
    window.visualViewport?.addEventListener('scroll', position)
    return () => {
      cancelAnimationFrame(positionFrame)
      element.removeEventListener('beforetoggle', beforeToggle)
      observer.disconnect()
      window.removeEventListener('resize', position)
      document.removeEventListener('scroll', position, true)
      window.visualViewport?.removeEventListener('resize', position)
      window.visualViewport?.removeEventListener('scroll', position)
    }
  }, [open, anchorRef, present, placement, offset, matchTriggerWidth])

  if (!present) return null
  return (
    <div
      {...props}
      ref={ref}
      popover="auto"
      className={`w-popover fixed inset-auto m-0 overflow-hidden rounded-lg border-[length:var(--popover-border-width,1px)] border-(--color-border) bg-[var(--popover-bg,var(--color-surface))] p-[var(--popover-padding,0px)] text-[color:var(--popover-text,var(--color-text))] shadow-[0_8px_28px] shadow-(color:--color-shadow)/20 ${className}`}
      data-state={open ? 'open' : 'closing'}
    >
      {children}
    </div>
  )
}
