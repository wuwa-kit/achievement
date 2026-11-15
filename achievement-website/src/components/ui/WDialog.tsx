import { useLayoutEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { useOverlayPresence } from './useOverlayPresence'
import './WDialog.css'

export type WDialogProps = Omit<ComponentPropsWithoutRef<'dialog'>, 'open'> & {
  open: boolean
  onOpenChange: (open: boolean) => void
  closeOnBackdrop?: boolean
}

export function WDialog({
  open,
  onOpenChange,
  closeOnBackdrop = false,
  className = '',
  onCancel,
  onClose,
  ...props
}: WDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const present = useOverlayPresence(open, ref)

  useLayoutEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    dialog.setAttribute('closedby', closeOnBackdrop ? 'any' : 'closerequest')
    if (open && !dialog.open) {
      // Prevent showModal() from saving the active control for focus restoration.
      const focused = dialog.ownerDocument.activeElement
      if (focused instanceof HTMLElement || focused instanceof SVGElement) focused.blur()
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, closeOnBackdrop])

  if (!present) return null
  return (
    <dialog
      {...props}
      ref={ref}
      className={`w-dialog fixed inset-0 m-auto max-h-[88dvh] max-w-[calc(100%-28px)] rounded-xl border border-(--color-border) bg-(--color-surface) p-[var(--dialog-padding,0px)] text-(--color-text) shadow-[0_28px_90px] shadow-(color:--color-shadow)/32 backdrop:bg-(--color-scrim) backdrop:backdrop-blur-xs ${className}`}
      data-state={open ? 'open' : 'closing'}
      onCancel={(event) => {
        onCancel?.(event)
        if (event.target !== event.currentTarget || event.defaultPrevented) return
        event.preventDefault()
        onOpenChange(false)
      }}
      onClose={(event) => {
        onClose?.(event)
        if (event.target === event.currentTarget && open && !event.currentTarget.open)
          onOpenChange(false)
      }}
    />
  )
}
