import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useViewerStore } from '../stores/viewer'

import { formatDate } from '../i18n'
import { WButton } from './ui/WButton'
import { WConfirmDialog } from './ui/WConfirmDialog'

export function ViewerReceiveStatus() {
  const { t: tr } = useTranslation()
  const { ticket, receipt, busy, receiving, receive } = useViewerStore(
    useShallow(({ ticket, receipt, busy, receiving, receive }) => ({
      ticket,
      receipt,
      busy,
      receiving,
      receive,
    })),
  )
  return (
    <>
      {ticket && receipt && !busy && !receiving && (
        <div className="ui-section my-4 flex flex-wrap items-center gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
          <div className="ui-p flex-1 text-sm text-(--color-muted)">{tr('ui.ackRetry')}</div>
          <WButton
            className="rounded-md border border-(--color-border) px-3 py-2 text-sm hover:bg-(--color-surface-hover)"
            onClick={() => void receive()}
          >
            {tr('ui.retryAck')}
          </WButton>
        </div>
      )}
    </>
  )
}

export function ViewerImportDialogs() {
  const { t: tr } = useTranslation()
  const { ticket, receipt, pendingImport, busy, receiving, receive, cancelReceive, confirmImport } =
    useViewerStore(
      useShallow(
        ({
          ticket,
          receipt,
          pendingImport,
          busy,
          receiving,
          receive,
          cancelReceive,
          confirmImport,
        }) => ({
          ticket,
          receipt,
          pendingImport,
          busy,
          receiving,
          receive,
          cancelReceive,
          confirmImport,
        }),
      ),
    )
  return (
    <>
      <WConfirmDialog
        open={!!ticket && !receipt && !pendingImport}
        heading={tr('ui.receiveDesktop')}
        message={tr('ui.receivePrompt')}
        cancelLabel={tr('common.cancel')}
        confirmLabel={receiving ? tr('ui.receiving') : tr('ui.confirmReceive')}
        loading={busy || receiving}
        testId="desktop-import-dialog"
        cancelTestId="cancel-desktop-import"
        confirmTestId="confirm-desktop-import"
        onConfirm={() => void receive()}
        onOpenChange={(open) => {
          if (!open) cancelReceive()
        }}
      />
      <WConfirmDialog
        open={!!pendingImport}
        heading={tr('ui.olderArchiveTitle')}
        message={
          pendingImport
            ? tr('ui.olderArchivePrompt', {
                incoming: formatDate(pendingImport.data.capturedAt),
                existing: formatDate(pendingImport.existingTime),
              })
            : ''
        }
        cancelLabel={tr('ui.keepLocalArchive')}
        confirmLabel={tr('ui.replaceArchive')}
        confirmTone="danger"
        loading={busy}
        testId="旧档案导入确认"
        cancelTestId="取消导入旧档案"
        confirmTestId="确认导入旧档案"
        onConfirm={() => void confirmImport(true)}
        onOpenChange={(open) => {
          if (!open) void confirmImport(false)
        }}
      />
    </>
  )
}
