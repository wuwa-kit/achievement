import { useTranslation } from 'react-i18next'
import { plainText, type Achievement } from '../lib/data'
import { WTooltip } from './ui/WTooltip'
import { WSvg } from './ui/WSvg'

export function AchievementSearch({
  item,
  language,
  compact = false,
}: {
  item: Achievement
  language: string
  compact?: boolean
}) {
  const { t } = useTranslation()
  const isChinese = language === 'zh-Hans' || language === 'zh-Hant'
  const searchTitle = isChinese
    ? plainText(item.texts['zh-Hans']?.title).trim() ||
      plainText(item.texts['zh-Hant']?.title).trim()
    : plainText(item.texts[language]?.title).trim()
  if (!searchTitle) return null
  const searchHref = isChinese
    ? `https://search.bilibili.com/all?${new URLSearchParams({ keyword: `鸣潮 ${searchTitle}` })}`
    : `https://www.google.com/search?${new URLSearchParams({ q: `Wuthering Waves ${searchTitle}` })}`

  return (
    <WTooltip text={t('ui.searchAchievementOn', { site: isChinese ? '哔哩哔哩' : 'Google' })}>
      <a
        className={`icon-button pointer-events-auto relative isolate inline-grid shrink-0 place-items-center rounded-[5px] text-(--color-muted) before:absolute before:-z-10 before:rounded-[5px] before:content-[''] hover:text-(--color-text) hover:before:bg-(--color-surface-soft) focus-visible:outline-none focus-visible:before:outline-2 focus-visible:before:outline-offset-2 focus-visible:before:outline-(--color-focus) motion-safe:w-transition-colors motion-safe:before:w-transition-colors ${compact ? 'ms-1.5 size-6 before:-inset-2' : 'size-8 before:inset-0'}`}
        href={searchHref}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => {
          if (event.detail > 0) event.currentTarget.blur()
        }}
        data-testid={compact ? `search-achievement-online-${item.id}` : 'search-achievement-online'}
      >
        <WSvg
          name="search"
          size={compact ? 16 : 18}
          className={compact ? 'group-data-[muted=true]/card:opacity-35' : undefined}
        />
      </a>
    </WTooltip>
  )
}
