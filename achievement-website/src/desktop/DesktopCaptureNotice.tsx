import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useDesktopStore } from '../stores/desktop'

import { WDialog } from '../components/ui/WDialog'
import { WButton } from '../components/ui/WButton'

export function DesktopCaptureNotice() {
  const { t } = useTranslation()
  const { state, pending, notice, dismissNotice, exportLogs } = useDesktopStore(
    useShallow(({ state, pending, notice, dismissNotice, exportLogs }) => ({
      state,
      pending,
      notice,
      dismissNotice,
      exportLogs,
    })),
  )
  const diagnostic = state.collectionDiagnostic
  const noticeCopy = `desktop.captureNotice.${notice ?? 'failed'}`
  const diagnosticCopy = 'desktop.captureDiagnostics'
  const failureReason =
    diagnostic?.code === 'windowTimeout' || diagnostic?.code === 'loginTimeout'
      ? `desktop.${diagnostic.code}`
      : `${diagnosticCopy}.reason.${diagnostic?.code ?? 'unexpected'}`

  return (
    <WDialog
      className="w-[440px] text-[14px] [--dialog-padding:20px]"
      open={!!notice}
      onOpenChange={(open) => {
        if (!open) dismissNotice()
      }}
      data-testid="collection-notice"
    >
      <div className="mb-2 text-[16px] font-semibold">{t(`${noticeCopy}.title`)}</div>
      <div className="leading-[1.6] wrap-anywhere">
        {notice === 'failed' && diagnostic
          ? t([failureReason, `${diagnosticCopy}.reason.unexpected`], {
              field: diagnostic.field,
              attempts: diagnostic.attempts,
            })
          : t(`${noticeCopy}.body`)}
      </div>
      {diagnostic && (
        <div className="mt-3 grid gap-1 text-[13px] wrap-anywhere">
          <div>
            {t(`${diagnosticCopy}.stage`, {
              stage: t(`${diagnosticCopy}.phase.${diagnostic.phase}`),
            })}
          </div>
          <div>{t(`${diagnosticCopy}.code`, { code: diagnostic.code })}</div>
          {diagnostic.nativeErrorCode !== null && (
            <div>{t(`${diagnosticCopy}.nativeCode`, { code: diagnostic.nativeErrorCode })}</div>
          )}
          {[
            'unexpected',
            'invalidModel',
            'heapFailed',
            'unstable',
            'memoryRead',
            'saveFailed',
          ].includes(diagnostic.code) && (
            <div data-testid="collection-diagnostics-detail">{diagnostic.detail}</div>
          )}
        </div>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <WButton
          className="rounded-md px-3 py-[7px] enabled:hover:bg-(--color-surface-hover)"
          disabled={pending || state.busy}
          onClick={() => void exportLogs()}
        >
          {t('desktop.exportLogs')}
        </WButton>
        <WButton
          autoFocus
          className="rounded-md bg-(--color-accent) px-3 py-[7px] text-(--color-on-accent) enabled:hover:bg-(--color-accent-hover)"
          onClick={dismissNotice}
        >
          {t('desktop.acknowledge')}
        </WButton>
      </div>
    </WDialog>
  )
}
