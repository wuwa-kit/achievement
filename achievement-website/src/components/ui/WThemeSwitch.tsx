import { useTranslation } from 'react-i18next'
import { useThemeStore, type ThemeMode } from '../../stores/theme'
import { WSelect } from './WSelect'
import { WOption } from './WOption'
import { WTooltip } from './WTooltip'
import { WSvg } from './WSvg'
const icons = { auto: 'circle-half', light: 'sun', dark: 'moon' } as const
export type WThemeSwitchProps = { showLabel?: boolean }

export function WThemeSwitch({ showLabel = false }: WThemeSwitchProps) {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const ready = useThemeStore((state) => state.ready)
  const setMode = useThemeStore((state) => state.setMode)
  return (
    <WTooltip text={showLabel ? '' : `${t('common.theme')} · ${t('common.' + mode)}`}>
      <WSelect
        className={`w-theme-switch shrink-0 ${showLabel ? 'min-h-11 w-full border-transparent [--select-px:12px]' : 'w-9 [--select-justify:center] [--select-px:0px]'}`}
        data-testid="theme-switch"
        value={mode}
        disabled={!ready}
        onValueChange={(value) => setMode(value as ThemeMode)}
        triggerContent={
          <>
            <WSvg name={icons[mode]} size={20} className="shrink-0" />
            {showLabel && (
              <>
                <span className="flex-1 text-start">{t('common.theme')}</span>
                <span className="text-xs text-(--color-muted)">{t('common.' + mode)}</span>
              </>
            )}
          </>
        }
      >
        {(['auto', 'light', 'dark'] as const).map((value) => (
          <WOption key={value} value={value}>
            {t('common.' + value)}
          </WOption>
        ))}
      </WSelect>
    </WTooltip>
  )
}
