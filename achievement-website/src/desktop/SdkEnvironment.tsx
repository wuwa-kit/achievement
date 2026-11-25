import { useTranslation } from 'react-i18next'
import { WButton } from '../components/ui/WButton'
import { WConfirmDialog } from '../components/ui/WConfirmDialog'
import { WTooltip } from '../components/ui/WTooltip'
import { useDesktopStore } from '../stores/desktop'

function useSdkLabel() {
  const { sdk, sdkChecking, sdkCheckFailed } = useDesktopStore()
  const { t } = useTranslation()
  const status = sdkChecking
    ? 'checking'
    : sdkCheckFailed
      ? 'checkFailed'
      : (sdk?.status ?? 'checking')
  const percent = sdk?.total ? Math.min(100, Math.floor((sdk.received / sdk.total) * 100)) : 0
  return (
    t(`desktop.sdk.${status}`) + (status === 'downloading' && !!sdk?.total ? ` ${percent}%` : '')
  )
}

export function SdkStatusButton() {
  const { openSdkDialog, sdk, sdkCheckFailed } = useDesktopStore()
  const { t } = useTranslation()
  const label = useSdkLabel()
  return (
    <div className="flex items-center gap-1">
      <span className="text-(--color-muted)">{t('desktop.sdk.label')}</span>
      <WTooltip text={t('desktop.sdk.details')}>
        <WButton
          className="rounded px-1.5 py-1 text-(--color-accent) enabled:hover:bg-(--color-surface-hover) data-warning:text-(--color-gold)"
          data-warning={
            sdk?.status === 'outdated' ||
            sdk?.status === 'incompatible' ||
            sdk?.status === 'failed' ||
            sdkCheckFailed ||
            undefined
          }
          data-testid="sdk-status"
          onClick={openSdkDialog}
        >
          {label}
        </WButton>
      </WTooltip>
    </div>
  )
}

export function SdkDialog() {
  const {
    sdkDialogOpen,
    closeSdkDialog,
    sdk,
    sdkChecking,
    sdkCheckFailed,
    sdkPreparing,
    sdkResume,
    sdkContinued,
    state,
    pending,
    prepareSdk,
    refreshSdk,
    cancelExport,
  } = useDesktopStore()
  const { t } = useTranslation()
  const label = useSdkLabel()
  const percent = sdk?.total ? Math.min(100, (sdk.received / sdk.total) * 100) : 0
  const status = sdkPreparing
    ? (sdk?.status ?? 'checking')
    : sdkChecking
      ? 'checking'
      : sdkCheckFailed
        ? 'checkFailed'
        : (sdk?.status ?? 'checking')
  const ready = status === 'ready'
  const retry = status === 'checkFailed' || status === 'incompatible'
  const headings = {
    checking: 'checkingTitle',
    failed: 'failedTitle',
    stopping: 'stoppingTitle',
    checkFailed: 'checkFailedTitle',
    missing: 'title',
    outdated: 'updateTitle',
    downloading: 'downloadTitle',
    preparing: 'preparingTitle',
    ready: 'readyTitle',
    incompatible: 'compatibilityTitle',
    notApplicable: 'title',
  } as const
  const descriptions = {
    checking: 'checkingDescription',
    failed: 'failedDescription',
    stopping: 'stoppingDescription',
    checkFailed: 'checkFailedDescription',
    missing: 'description',
    outdated: 'updateDescription',
    downloading: sdkResume ? 'downloadResumeDescription' : 'downloadDescription',
    preparing: sdkResume ? 'prepareResumeDescription' : 'preparingDescription',
    ready: sdkContinued && state.busy ? 'continuedDescription' : 'readyDescription',
    incompatible: 'versionMismatch',
    notApplicable: 'description',
  } as const
  const confirmLabel = sdkPreparing
    ? t(sdk?.status === 'downloading' ? 'desktop.sdk.cancelDownload' : 'desktop.sdk.stopPreparing')
    : retry
      ? t('desktop.sdk.retry')
      : status === 'failed'
        ? t('desktop.sdk.retryPreparation')
        : ready || status === 'checking'
          ? undefined
          : t(status === 'outdated' ? 'desktop.sdk.update' : 'desktop.sdk.prepare')
  return (
    <WConfirmDialog
      open={sdkDialogOpen}
      onOpenChange={(open) => {
        if (!open) closeSdkDialog()
      }}
      heading={t(`desktop.sdk.${headings[status]}`)}
      message={t(`desktop.sdk.${descriptions[status]}`)}
      cancelLabel={t(ready ? 'desktop.acknowledge' : 'desktop.sdk.close')}
      confirmLabel={confirmLabel}
      confirmDisabled={sdkPreparing ? status === 'stopping' : sdkChecking || pending || state.busy}
      onConfirm={() => {
        void (sdkPreparing ? cancelExport() : retry ? refreshSdk() : prepareSdk())
      }}
      testId="sdk-dialog"
      confirmTestId={sdkPreparing || retry ? undefined : 'sdk-prepare'}
    >
      {sdk && sdk.total > 0 && ['missing', 'outdated', 'downloading'].includes(status) && (
        <div
          className="mt-4 flex items-center justify-between gap-4 text-(--color-muted)"
          data-testid="sdk-download-summary"
        >
          <span>{t('desktop.sdk.size', { total: Math.ceil(sdk.total / 1024 / 1024) })}</span>
          {status === 'downloading' && (
            <span className="shrink-0" data-testid="sdk-download-progress">
              {label}
            </span>
          )}
        </div>
      )}
      {status === 'downloading' && !!sdk?.total && (
        <div className="mt-3 h-1.5 overflow-hidden rounded bg-(--color-border)">
          <div className="h-full bg-(--color-accent)" style={{ width: `${percent}%` }} />
        </div>
      )}
    </WConfirmDialog>
  )
}
