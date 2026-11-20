import { useTranslation } from 'react-i18next'
import { useThemeStore, type ThemeMode } from '../../stores/theme'
import { WSelect } from './WSelect'
import { WOption } from './WOption'
import { WTooltip } from './WTooltip'
import { WSvg } from './WSvg'
const icons = { auto: 'circle-half', light: 'sun', dark: 'moon' } as const
export function WThemeSwitch() {
  const { t } = useTranslation()
  const mode = useThemeStore((state) => state.mode)
  const ready = useThemeStore((state) => state.ready)
  const setMode = useThemeStore((state) => state.setMode)
  return (
    <WTooltip text={`${t('common.theme')} · ${t('common.' + mode)}`}>
      <WSelect
        className="w-theme-switch w-9 shrink-0 [--select-justify:center] [--select-px:0px]"
        data-testid="theme-switch"
        value={mode}
        disabled={!ready}
        onValueChange={(value) => setMode(value as ThemeMode)}
        triggerContent={<WSvg name={icons[mode]} size={20} />}
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
