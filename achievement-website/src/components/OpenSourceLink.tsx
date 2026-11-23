import { useTranslation } from 'react-i18next'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'
import { iconButtonClass } from './ui/WIconButton'

export function OpenSourceLink() {
  const { t } = useTranslation()

  return (
    <WTooltip text={t('common.openSource')}>
      <a
        className={`open-source-link ${iconButtonClass}`}
        href="https://github.com/wuwa-kit/achievement"
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (event.detail > 0) event.currentTarget.blur()
        }}
      >
        <WSvg name="github" size={20} />
      </a>
    </WTooltip>
  )
}
