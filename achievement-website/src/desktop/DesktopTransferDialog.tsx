import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useDesktopStore } from '../stores/desktop'

import { WDialog } from '../components/ui/WDialog'
import { WButton } from '../components/ui/WButton'
import { WTooltip } from '../components/ui/WTooltip'
import { WSvg } from '../components/ui/WSvg'

export function DesktopTransferDialog() {
  const { t } = useTranslation()
  const { state, pending, cancelExport, copyTransferLink } = useDesktopStore(
    useShallow(({ state, pending, cancelExport, copyTransferLink }) => ({
      state,
      pending,
      cancelExport,
      copyTransferLink,
    })),
  )
  return (
    <WDialog
      className="w-[480px] text-[14px] [--dialog-padding:20px]"
      open={!!state.transferUrl}
      onOpenChange={(open) => {
        if (!open) void cancelExport()
      }}
      data-testid="transfer-dialog"
    >
      <div className="mb-2 text-[16px] font-semibold">{t('desktop.transfer.running')}</div>
      <div className="mb-3 leading-[1.6] text-(--color-muted)">
        {t('desktop.transfer.instructions')}
      </div>
      <div className="flex items-start gap-2 rounded-md border border-(--color-border) bg-(--color-surface-soft) p-2">
        <div
          className="min-w-0 flex-1 select-all wrap-anywhere px-1 py-1 text-[13px]"
          data-testid="transfer-url"
        >
          {state.transferUrl}
        </div>
        <WTooltip text={t('desktop.transfer.copyLink')}>
          <WButton
            className="grid size-8 shrink-0 place-items-center rounded-md enabled:hover:bg-(--color-surface-hover)"
            data-testid="transfer-copy-link"
            disabled={pending}
            onClick={() => void copyTransferLink()}
          >
            <WSvg name="copy" size={16} />
          </WButton>
        </WTooltip>
      </div>
      <div className="mt-5 flex justify-end">
        <WButton
          className="rounded-md bg-(--color-accent) px-3 py-[7px] text-(--color-on-accent) enabled:hover:bg-(--color-accent-hover)"
          disabled={pending}
          onClick={() => void cancelExport()}
        >
          {t('desktop.transfer.stop')}
        </WButton>
      </div>
    </WDialog>
  )
}
