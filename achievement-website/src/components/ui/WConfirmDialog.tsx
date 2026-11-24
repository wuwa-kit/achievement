import { createPortal } from 'react-dom'
import { WButton } from './WButton'
import { WDialog } from './WDialog'

export type WConfirmDialogProps = {
  open: boolean
  heading: string
  message: string
  cancelLabel: string
  confirmLabel: string
  confirmTone?: 'danger'
  loading?: boolean
  testId?: string
  cancelTestId?: string
  confirmTestId?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function WConfirmDialog({
  open,
  heading,
  message,
  cancelLabel,
  confirmLabel,
  confirmTone,
  loading,
  testId,
  cancelTestId,
  confirmTestId,
  onOpenChange,
  onConfirm,
}: WConfirmDialogProps) {
  return createPortal(
    <WDialog
      className="w-confirm-dialog w-[440px] text-[14px] [--dialog-padding:20px]"
      open={open}
      onOpenChange={onOpenChange}
      data-testid={testId}
    >
      <div className="w-confirm-dialog-heading mb-2 text-[16px] font-semibold">{heading}</div>
      <div className="w-confirm-dialog-message leading-[1.6] wrap-anywhere">
        {message}
      </div>
      <div className="w-confirm-dialog-actions mt-5 flex flex-wrap justify-end gap-2">
        <WButton
          className="w-confirm-dialog-button rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-[7px] text-(--color-text) enabled:hover:bg-(--color-surface-hover)"
          autoFocus
          disabled={loading}
          data-testid={cancelTestId}
          onClick={() => onOpenChange(false)}
        >
          {cancelLabel}
        </WButton>
        <WButton
          className="w-confirm-dialog-button rounded-md border border-transparent bg-(--color-accent) px-3 py-[7px] text-(--color-on-accent) enabled:hover:bg-(--color-accent-hover) data-[tone=danger]:border-[color-mix(in_srgb,var(--color-danger)_50%,var(--color-border))] data-[tone=danger]:bg-[color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] data-[tone=danger]:text-(--color-danger) data-[tone=danger]:enabled:hover:bg-[color-mix(in_srgb,var(--color-danger)_18%,var(--color-surface))]"
          data-confirm
          data-tone={confirmTone}
          loading={loading}
          data-testid={confirmTestId}
          onClick={onConfirm}
        >
          {confirmLabel}
        </WButton>
      </div>
    </WDialog>,
    document.body,
  )
}
