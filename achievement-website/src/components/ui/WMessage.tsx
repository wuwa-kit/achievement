import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { WButton } from './WButton'
import { WSvg } from './WSvg'
import './WMessage.css'

export { wMessage } from '../../stores/message'
import { useMessageStore, dismissMessage } from '../../stores/message'
const messageIcons = { success: 'check', error: 'circle-x', info: 'info' } as const
export function WMessage() {
  const message = useMessageStore((state) => state.message)
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (message && !ref.current?.matches(':popover-open')) ref.current?.showPopover()
  }, [message])
  if (!message) return null
  return createPortal(
    <div
      ref={ref}
      popover="manual"
      className="w-message-host fixed inset-x-4 top-6 mx-auto my-0 w-fit max-w-[min(520px,calc(100vw-32px))] overflow-visible bg-transparent text-(--color-text)"
    >
      <div
        key={message.id}
        className="w-message flex items-center gap-2.5 rounded-[9px] border border-(--color-border) bg-(--color-surface) px-3.5 py-3 text-[13px] leading-[1.6] shadow-[0_6px_24px] shadow-(color:--color-shadow)/18 data-[type=error]:border-[color-mix(in_srgb,var(--color-danger)_45%,var(--color-border))] data-[type=error]:text-(--color-danger) animate-[w-message-enter_180ms_ease-out_both] data-[closing=true]:animate-[w-message-leave_180ms_ease-in_both] motion-safe:w-transition-colors"
        data-type={message.type}
        data-closing={message.closing}
      >
        <WSvg name={messageIcons[message.type]} size={18} />
        <span className="min-w-0 wrap-anywhere">{message.text}</span>
        <WButton
          className="w-message-close grid shrink-0 place-items-center rounded-sm p-1 hover:bg-(--color-surface-hover)"
          onClick={dismissMessage}
        >
          <WSvg name="x" size={16} />
        </WButton>
      </div>
    </div>,
    document.body,
  )
}
