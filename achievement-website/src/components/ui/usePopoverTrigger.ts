import { useId, useRef, type MouseEvent } from 'react'

export function usePopoverTrigger(open: boolean, onOpenChange: (open: boolean) => void) {
  const id = useId()
  const anchorRef = useRef<HTMLButtonElement>(null)

  return {
    anchorRef,
    triggerProps: {
      ref: anchorRef,
      popoverTarget: id,
      'data-expanded': open,
      onClick(event: MouseEvent<HTMLButtonElement>) {
        if (event.defaultPrevented) return
        // The native invoker association prevents light-dismiss before this click.
        // React owns the toggle, so cancel the button's native toggle action.
        event.preventDefault()
        onOpenChange(!open)
      },
    },
    popoverProps: { id, anchorRef, open, onOpenChange },
  }
}
