import { useDesktopStore } from '../stores/desktop'
import { WThemeSwitch } from '../components/ui/WThemeSwitch'
import { WTooltip } from '../components/ui/WTooltip'
import { WSvg } from '../components/ui/WSvg'
import { useEffect, useRef, useState } from 'react'
import { ArchiveDeleteDialog } from '../components/ArchiveDeleteDialog'
import { OpenSourceLink } from '../components/OpenSourceLink'
import { WButton } from '../components/ui/WButton'
import { WDialog } from '../components/ui/WDialog'
import { WInput } from '../components/ui/WInput'
import { WLanguageSwitch } from '../components/ui/WLanguageSwitch'
import { useTranslation } from 'react-i18next'
import { HistoryCard } from './HistoryCard'

export default function DesktopApp() {
  const {
    settings,
    state,
    historySummaries,
    loaded,
    pending,
    notice,
    connect,
    dismissNotice,
    openCollectionDiagnostics,
    copyCollectionDiagnostics,
    exportLogs,
    setGamePath,
    detectPath,
    choosePath,
    startExport,
    cancelExport,
    copyTransferLink,
    exportHistory,
    deleteHistory,
  } = useDesktopStore()
  const { t } = useTranslation()
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; uid: string } | null>(null)
  const lastTransferUrl = useRef<string | null>(null)
  useEffect(connect, [connect])
  if (state.transferUrl) lastTransferUrl.current = state.transferUrl

  const disabled = !loaded || pending || state.busy
  const sending = state.stage === 'sending'
  const exportRunning = state.busy && !sending
  const status = `desktop.captureStatus.${exportRunning ? state.stage : 'ready'}`
  const diagnostic = state.collectionDiagnostic
  const noticeCopy = `desktop.captureNotice.${notice ?? 'failed'}`
  const diagnosticCopy = 'desktop.captureDiagnostics'
  const failureReason =
    diagnostic?.code === 'windowTimeout' || diagnostic?.code === 'loginTimeout'
      ? `desktop.${diagnostic.code}`
      : `${diagnosticCopy}.reason.${diagnostic?.code ?? 'unexpected'}`
  const exportAction = t(exportRunning ? 'desktop.cancel' : 'desktop.start')
  return (
    <div className="desktop-page m-auto max-w-[760px] p-7 text-(--color-text) desktop-narrow:p-5">
      <div className="desktop-settings mb-4" data-testid={t('desktop.settings')}>
        <div className="desktop-header mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0 text-[16px] wrap-anywhere">{t('desktop.game')}</div>
          <div className="desktop-tools flex shrink-0 items-center gap-2">
            <WTooltip text={t('desktop.exportLogs')}>
              <WButton
                className="grid size-9 shrink-0 place-items-center rounded-md border border-(--color-border) bg-(--color-surface) enabled:hover:bg-(--color-surface-soft)"
                data-testid="desktop-export-logs"
                disabled={disabled}
                onClick={() => void exportLogs()}
              >
                <WSvg name="file-export" size={20} />
              </WButton>
            </WTooltip>
            <WThemeSwitch />
            <WLanguageSwitch />
            <OpenSourceLink />
          </div>
        </div>
        <div className="flex gap-2.5">
          <WInput
            id="game-path"
            className="flex-1"
            data-testid={t('desktop.game')}
            placeholder={t('desktop.gamePlaceholder')}
            value={settings.gamePath}
            disabled={disabled}
            onChange={(e) => setGamePath(e.target.value)}
          />
          <WTooltip text={t('desktop.detect')}>
            <WButton
              className="desktop-path-action grid min-h-10 w-10 shrink-0 place-items-center rounded-md border border-(--color-border) bg-(--color-surface) enabled:hover:bg-(--color-surface-soft)"
              data-testid={t('desktop.detect')}
              disabled={disabled}
              onClick={() => void detectPath()}
            >
              <WSvg name="search" size={18} />
            </WButton>
          </WTooltip>
          <WTooltip text={t('desktop.choose')}>
            <WButton
              className="desktop-path-action grid min-h-10 w-10 shrink-0 place-items-center rounded-md border border-(--color-border) bg-(--color-surface) enabled:hover:bg-(--color-surface-soft)"
              data-testid={t('desktop.choose')}
              disabled={disabled}
              onClick={() => void choosePath()}
            >
              <WSvg name="folder-open" size={18} />
            </WButton>
          </WTooltip>
        </div>
      </div>
      {loaded && <div className="mb-2 text-[16px]">{t('desktop.capture')}</div>}
      {loaded && (
        <div className="ui-section desktop-card flex items-center gap-4 rounded-[9px] border border-(--color-border) bg-(--color-surface) px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="ui-p desktop-stage m-0 flex items-center gap-2 text-[16px] leading-normal">
              {exportRunning && (
                <WSvg
                  name="loader-circle"
                  size="1em"
                  className="text-(--color-accent) motion-safe:animate-spin motion-safe:[animation-duration:900ms]"
                />
              )}
              <span className="min-w-0 wrap-anywhere">{t(`${status}.title`)}</span>
            </div>
            <div className="desktop-description mt-1 text-[13px] leading-normal wrap-anywhere text-(--color-muted)">
              {t(`${status}.body`)}
            </div>
          </div>
          <WTooltip text={exportAction}>
            <WButton
              className="desktop-export-toggle grid size-9 shrink-0 place-items-center rounded-full border border-(--color-accent) bg-(--color-accent) text-(--color-on-accent) enabled:hover:bg-(--color-accent-hover) data-running:bg-(--color-surface) data-running:text-(--color-accent) data-running:enabled:hover:bg-(--color-surface-hover)"
              disabled={
                pending ||
                sending ||
                !!notice ||
                state.stage === 'closing' ||
                state.stage === 'stopping'
              }
              data-testid={exportAction}
              data-running={exportRunning || undefined}
              onClick={() => void (exportRunning ? cancelExport() : startExport())}
            >
              <WSvg name={exportRunning ? 'stop' : 'play'} size={20} />
            </WButton>
          </WTooltip>
        </div>
      )}
      {loaded && (
        <div className="desktop-history mt-7 flex flex-col gap-3">
          <div className="desktop-history-heading text-[16px]">{t('desktop.history')}</div>
          {!state.history?.length && (
            <div className="desktop-history-empty pb-5 text-[13px] text-(--color-muted)">
              {t('desktop.noHistory')}
            </div>
          )}
          {state.history?.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              summary={historySummaries[entry.id]}
              disabled={disabled}
              onExport={(format) => void exportHistory(entry.id, format)}
              onDelete={() => {
                setDeleteTarget({ id: entry.id, uid: entry.uid })
              }}
            />
          ))}
        </div>
      )}
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
            {lastTransferUrl.current}
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
            {diagnostic.directory && (
              <div data-testid="collection-diagnostics-directory">{diagnostic.directory}</div>
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
          {diagnostic && (
            <WButton
              className="rounded-md px-3 py-[7px] enabled:hover:bg-(--color-surface-hover)"
              disabled={pending}
              onClick={() => void copyCollectionDiagnostics()}
            >
              {t(`${diagnosticCopy}.copy`)}
            </WButton>
          )}
          {diagnostic?.directory && (
            <WButton
              className="rounded-md px-3 py-[7px] enabled:hover:bg-(--color-surface-hover)"
              disabled={pending}
              onClick={() => void openCollectionDiagnostics()}
            >
              {t(`${diagnosticCopy}.open`)}
            </WButton>
          )}
          <WButton
            autoFocus
            className="rounded-md bg-(--color-accent) px-3 py-[7px] text-(--color-on-accent) enabled:hover:bg-(--color-accent-hover)"
            onClick={dismissNotice}
          >
            {t('desktop.acknowledge')}
          </WButton>
        </div>
      </WDialog>
      <ArchiveDeleteDialog
        open={!!deleteTarget}
        message={t('desktop.deleteHistoryPrompt', { uid: deleteTarget?.uid ?? '' })}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) void deleteHistory(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
