import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { WButton } from '../components/ui/WButton'
import { WIconButton } from '../components/ui/WIconButton'
import { WDialog } from '../components/ui/WDialog'
import { WScrollArea } from '../components/ui/WScrollArea'
import { WSvg } from '../components/ui/WSvg'
import { WTooltip } from '../components/ui/WTooltip'
import { useDesktopStore } from '../stores/desktop'
import { useDesktopUpdateStore } from '../stores/desktop-update'
import { isDesktop } from './bridge'

const buttonClass =
  'rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-[7px] enabled:hover:bg-(--color-surface-hover)'
const megabytes = (bytes: number) => (bytes / 1_000_000).toFixed(1)

export function DesktopUpdate() {
  const { t } = useTranslation()
  const {
    offer,
    open,
    manualChecking,
    status,
    received,
    connect,
    check,
    dismiss,
    download,
    restart,
  } = useDesktopUpdateStore()
  const busy = useDesktopStore(({ state, pending }) => state.busy || pending)
  useEffect(connect, [connect])
  if (!isDesktop) return null

  const total = offer?.release.size ?? 0
  const progress = total > 0 ? Math.floor((received / total) * 100) : 0
  const ready = status === 'ready' || status === 'restarting'
  const downloading = status === 'downloading' || status === 'cancelling'
  const cancelling = status === 'cancelling'
  const restarting = status === 'restarting'

  return (
    <>
      <WTooltip text={t('desktop.update.check')}>
        <WIconButton
          data-testid="desktop-check-update"
          loading={manualChecking}
          onClick={() => void check(true)}
        >
          <WSvg
            name={manualChecking ? 'loader-circle' : 'refresh-cw'}
            size={20}
            className={manualChecking ? 'motion-safe:animate-spin' : undefined}
          />
        </WIconButton>
      </WTooltip>
      <WDialog
        className="w-[480px] text-[14px] [--dialog-padding:20px]"
        open={open && !!offer}
        onOpenChange={(next) => {
          if (!next) void dismiss()
        }}
        data-testid="desktop-update-dialog"
      >
        {offer && (
          <>
            <div className="text-[17px] font-semibold">{t('desktop.update.available')}</div>
            <WScrollArea className="mt-4 max-h-[min(26dvh,180px)] rounded-md bg-(--color-surface-soft) p-3 leading-[1.55] wrap-anywhere whitespace-pre-wrap">
              {offer.release.notes}
            </WScrollArea>
            <div className="mt-3 text-(--color-muted)" data-testid="desktop-update-size">
              {t('desktop.update.size', { total: megabytes(total) })}
            </div>
            <div className="mt-3 h-10" data-testid="desktop-update-progress">
              {(downloading || ready) && (
                <>
                  <div className="h-1.5 overflow-hidden rounded-full bg-(--color-surface-soft)">
                    <div
                      className="h-full rounded-full bg-(--color-accent) motion-safe:transition-[width]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-(--color-muted)">
                    {cancelling
                      ? t('desktop.update.cancelling')
                      : ready
                        ? t(busy ? 'desktop.update.busy' : 'desktop.update.downloaded')
                        : t('desktop.update.progress', {
                            percent: progress,
                            current: megabytes(received),
                            total: megabytes(total),
                          })}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {(status === 'idle' || status === 'failed') && (
                <a
                  className="mr-auto rounded-md border border-(--color-border) bg-(--color-surface) px-3 py-[7px] hover:bg-(--color-surface-hover)"
                  href="https://wu.songe.li/?download=1"
                  target="_blank"
                  rel="noreferrer"
                  data-testid="desktop-update-external-download"
                >
                  {t('desktop.update.externalDownload')}
                </a>
              )}
              <WButton
                className={buttonClass}
                autoFocus
                disabled={cancelling || restarting}
                onClick={() => void dismiss()}
              >
                {t('common.cancel')}
              </WButton>
              <WButton
                className="rounded-md border border-transparent bg-(--color-accent) px-3 py-[7px] text-(--color-on-accent) enabled:hover:bg-(--color-accent-hover)"
                data-testid="desktop-update-action"
                disabled={downloading || (ready && busy)}
                loading={restarting}
                onClick={() => void (ready ? restart() : download())}
              >
                {t(
                  ready
                    ? 'desktop.update.restart'
                    : status === 'failed'
                      ? 'desktop.update.retry'
                      : 'desktop.update.download',
                )}
              </WButton>
            </div>
          </>
        )}
      </WDialog>
    </>
  )
}
