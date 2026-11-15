import { useTranslation } from 'react-i18next'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'

export function OpenSourceLink() {
  const { t } = useTranslation()

  return (
    <WTooltip text={t('common.openSource')}>
      <a
        className="open-source-link flex size-9 shrink-0 items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) hover:bg-(--color-surface-soft)"
        href="https://github.com/wuwa-kit/achievement"
        target="_blank"
        rel="noreferrer"
      >
        <WSvg name="github" size={20} />
      </a>
    </WTooltip>
  )
}
