import { useTranslation } from 'react-i18next'
import { useLanguageStore } from '../../stores/language'
import { WSelect } from './WSelect'
import { WOption } from './WOption'
import { WTooltip } from './WTooltip'
import { WSvg } from './WSvg'
import { languageOptions, type AppLanguage } from '../../i18n/index.ts'
export function WLanguageSwitch() {
  const { t } = useTranslation()
  const language = useLanguageStore((state) => state.language)
  const ready = useLanguageStore((state) => state.ready)
  const setLanguage = useLanguageStore((state) => state.setLanguage)
  return (
    <WTooltip text={t('common.language')}>
      <WSelect
        className="w-language-switch desktop-language w-9 shrink-0 [--select-justify:center] [--select-px:0px]"
        data-testid={t('common.language')}
        value={language}
        disabled={!ready}
        onValueChange={(value) => setLanguage(value as AppLanguage)}
        triggerContent={<WSvg name="languages" size={20} />}
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
