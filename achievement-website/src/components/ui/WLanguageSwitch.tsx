import { useTranslation } from 'react-i18next'
import { useLanguageStore } from '../../stores/language'
import { WSelect } from './WSelect'
import { WOption } from './WOption'
import { WTooltip } from './WTooltip'
import { WSvg } from './WSvg'
import { languageOptions, type AppLanguage } from '../../i18n/index.ts'
export type WLanguageSwitchProps = { showLabel?: boolean }

export function WLanguageSwitch({ showLabel = false }: WLanguageSwitchProps) {
  const { t } = useTranslation()
  const language = useLanguageStore((state) => state.language)
  const ready = useLanguageStore((state) => state.ready)
  const setLanguage = useLanguageStore((state) => state.setLanguage)
  return (
    <WTooltip text={showLabel ? '' : t('common.language')}>
      <WSelect
        className={`w-language-switch desktop-language shrink-0 ${showLabel ? 'min-h-11 w-full border-transparent [--select-px:12px]' : 'w-9 [--select-justify:center] [--select-px:0px]'}`}
        data-testid={t('common.language')}
        value={language}
        disabled={!ready}
        onValueChange={(value) => setLanguage(value as AppLanguage)}
        triggerContent={
          <>
            <WSvg name="languages" size={20} className="shrink-0" />
            {showLabel && (
              <>
                <span className="flex-1 text-start">{t('common.language')}</span>
                <span className="text-xs text-(--color-muted)">
                  {languageOptions.find(({ value }) => value === language)?.label}
                </span>
              </>
            )}
          </>
        }
        placement="bottom-end"
      >
        {languageOptions.map(({ value, label }) => (
          <WOption key={value} value={value}>
            {label}
          </WOption>
        ))}
      </WSelect>
    </WTooltip>
  )
}
