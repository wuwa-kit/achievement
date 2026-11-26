import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useDesktopStore } from '../stores/desktop'

import { WButton } from '../components/ui/WButton'
import { WTooltip } from '../components/ui/WTooltip'
import { WSvg } from '../components/ui/WSvg'

export function DesktopCapture({ onQualityRequired }: { onQualityRequired: () => void }) {
  const { t } = useTranslation()
  const { loaded, state, pending, notice, sdkPreparing, startExport, cancelExport } =
    useDesktopStore(
      useShallow(({ loaded, state, pending, notice, sdkPreparing, startExport, cancelExport }) => ({
        loaded,
        state,
        pending,
        notice,
        sdkPreparing,
        startExport,
        cancelExport,
      })),
    )
  const sending = state.stage === 'sending'
  const exportRunning = state.busy && !sending && !sdkPreparing
  const status = `desktop.captureStatus.${exportRunning ? state.stage : 'ready'}`
  const exportAction = t(exportRunning ? 'desktop.cancel' : 'desktop.start')
  return (
    <>
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
              onClick={async () => {
                if (exportRunning) await cancelExport()
                else if (await startExport()) onQualityRequired()
              }}
            >
              <WSvg name={exportRunning ? 'stop' : 'play'} size={20} />
            </WButton>
          </WTooltip>
        </div>
      )}
    </>
  )
}
