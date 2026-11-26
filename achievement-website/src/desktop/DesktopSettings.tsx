import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useDesktopStore } from '../stores/desktop'

import { useEffect, useRef } from 'react'
import { useDebounceEffect } from 'ahooks'
import { WInput } from '../components/ui/WInput'
import { WIconButton } from '../components/ui/WIconButton'
import { WSelect } from '../components/ui/WSelect'
import { WOption } from '../components/ui/WOption'
import { WTooltip } from '../components/ui/WTooltip'
import { WSvg } from '../components/ui/WSvg'
import { DesktopToolbar } from './DesktopToolbar'
import { SdkDialog, SdkStatusButton } from './SdkEnvironment'

export function DesktopSettings({
  promptQuality,
  onQualityPromptChange,
}: {
  promptQuality: boolean
  onQualityPromptChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const {
    settings,
    state,
    loaded,
    pending,
    setGamePath,
    detectedQuality,
    localTiers,
    wegame,
    gameDetected,
    refreshSdk,
    refreshQuality,
    setQuality,
    detectPath,
    choosePath,
  } = useDesktopStore(
    useShallow(
      ({
        settings,
        state,
        loaded,
        pending,
        setGamePath,
        detectedQuality,
        localTiers,
        wegame,
        gameDetected,
        refreshSdk,
        refreshQuality,
        setQuality,
        detectPath,
        choosePath,
      }) => ({
        settings,
        state,
        loaded,
        pending,
        setGamePath,
        detectedQuality,
        localTiers,
        wegame,
        gameDetected,
        refreshSdk,
        refreshQuality,
        setQuality,
        detectPath,
        choosePath,
      }),
    ),
  )
  useDebounceEffect(
    () => {
      if (loaded) void refreshQuality()
    },
    [loaded, settings.gamePath, refreshQuality],
    { wait: 250 },
  )
  useEffect(() => {
    if (wegame) void refreshSdk()
  }, [wegame, settings.gamePath, refreshSdk])
  const qualityRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!promptQuality || pending) return
    const trigger = qualityRef.current
    trigger?.focus()
    if (trigger?.dataset.expanded === 'false') trigger.click()
    onQualityPromptChange(false)
  }, [promptQuality, pending, onQualityPromptChange])
  const autoLabel =
    detectedQuality === undefined
      ? t('common.auto')
      : t('desktop.quality.auto', { tier: t(`desktop.quality.${detectedQuality ?? 'unknown'}`) })
  const unknownTier = t('desktop.quality.unknown')
  const [autoPrefix, autoSuffix] = autoLabel.split(unknownTier)

  const disabled = !loaded || pending || state.busy
  return (
    <>
      <div className="desktop-settings mb-4" data-testid={t('desktop.settings')}>
        <DesktopToolbar />
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
            <WIconButton
              className="desktop-path-action"
              data-testid={t('desktop.detect')}
              disabled={disabled}
              onClick={() => void detectPath()}
            >
              <WSvg name="search" size={20} />
            </WIconButton>
          </WTooltip>
          <WTooltip text={t('desktop.choose')}>
            <WIconButton
              className="desktop-path-action"
              data-testid={t('desktop.choose')}
              disabled={disabled}
              onClick={() => void choosePath()}
            >
              <WSvg name="folder-open" size={20} />
            </WIconButton>
          </WTooltip>
        </div>
      </div>
      {loaded && (
        <div
          className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md bg-(--color-surface) px-3 py-2 text-[13px]"
          data-testid="game-environment"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-(--color-muted)">{t('desktop.sdk.channel')}</span>
            <span>
              {t(
                wegame
                  ? 'desktop.wegame'
                  : gameDetected
                    ? 'desktop.sdk.official'
                    : 'desktop.sdk.unknown',
              )}
            </span>
            {wegame && <SdkStatusButton />}
          </div>
          <div className="flex min-w-0 items-center gap-1 text-[13px] text-(--color-muted)">
            <span>{t('desktop.quality.label')}</span>
            <WSelect
              ref={qualityRef}
              data-testid="resource-quality"
              className="h-7 border-transparent bg-transparent px-1 text-[13px]"
              placement="bottom-end"
              disabled={disabled}
              value={settings.quality ?? 'auto'}
              onValueChange={(value) => {
                if (value === 'auto' || value === 'sd' || value === 'hd' || value === 'uhd')
                  setQuality(value)
              }}
            >
              <WOption value="auto">
                {detectedQuality === null ? (
                  <>
                    {autoPrefix}
                    <span className="text-(--color-gold)">{unknownTier}</span>
                    {autoSuffix}
                  </>
                ) : (
                  autoLabel
                )}
              </WOption>
              {(['sd', 'hd', 'uhd'] as const).map((tier) => (
                <WOption
                  key={tier}
                  value={tier}
                  indicator={
                    localTiers.includes(tier) && (
                      <WTooltip text={t('desktop.quality.detected')}>
                        <span
                          className="ms-2 inline-flex align-middle text-(--color-muted)"
                          data-testid="local-resource-icon"
                        >
                          <WSvg name="folder-open" size={15} />
                        </span>
                      </WTooltip>
                    )
                  }
                >
                  {t(`desktop.quality.${tier}`)}
                </WOption>
              ))}
            </WSelect>
          </div>
        </div>
      )}
      <SdkDialog />
    </>
  )
}
