import { useTranslation } from 'react-i18next'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'
import { iconButtonClass } from './ui/WIconButton'

export function OpenSourceLink({ showLabel = false }: { showLabel?: boolean }) {
  const { t } = useTranslation()

  return (
    <WTooltip text={showLabel ? '' : t('common.openSource')}>
      <a
        className={`open-source-link ${showLabel ? 'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-(--color-surface-soft)' : iconButtonClass}`}
        href="https://github.com/wuwa-kit/achievement"
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (event.detail > 0) event.currentTarget.blur()
        }}
      >
        <WSvg name="github" size={20} />
        {showLabel && <span>{t('common.openSource')}</span>}
      </a>
    </WTooltip>
  )
}
