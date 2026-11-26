import { useTranslation } from 'react-i18next'
import { getAchievementRoles } from '../lib/achievement-roles'
import { achievementVersionById } from '../lib/achievement-versions'
import { getAchievementStars, isFinished, plainText, type Achievement } from '../lib/data'
import astriteIcon from '../assets/achievement-icons/astrite.png?no-inline'
import { AchievementEmblem } from './AchievementEmblem'
import { AchievementSearch } from './AchievementSearch'
import { useAchievementHighlight } from './useAchievementHighlight'
import { WButton } from './ui/WButton'
import { WTooltip } from './ui/WTooltip'
import { WSvg } from './ui/WSvg'

function AchievementSummary({
  item,
  language,
  query,
  onOpenDetails,
}: {
  item: Achievement
  language: string
  query: string
  onOpenDetails: () => void
}) {
  const { t } = useTranslation()
  const title = plainText(item.texts[language]?.title)
  const description = plainText(item.texts[language]?.description)
  const version = achievementVersionById.get(item.id)
  const titleRef = useAchievementHighlight(title, query)
  const descriptionRef = useAchievementHighlight(description, query)

  return (
    <span className="achievement-info pointer-events-none z-10 col-start-2 flex min-w-0 flex-col gap-1 group-data-[muted=true]/card:text-(--color-muted)/85 narrow:gap-0.5">
      <span className="achievement-title flex items-center gap-1 text-[14px] leading-[1.6] font-[550] narrow:text-[12px]">
        <WButton
          className="group/title pointer-events-none min-w-0 rounded-sm text-left wrap-anywhere whitespace-pre-line"
          data-testid={`查看成就详情 ${item.id}`}
          onClick={onOpenDetails}
        >
          <span className="pointer-events-auto box-decoration-clone border-b border-transparent pb-0.5 group-hover/title:border-current group-focus-visible/title:border-current">
            <span ref={titleRef} className="achievement-title-text">
              {title || t('ui.missingTitle')}
            </span>
          </span>
          {version && (
            <span className="achievement-version ms-0.5 align-super text-[0.72em] leading-none font-semibold whitespace-nowrap text-(--color-search-match) group-data-[muted=true]/card:text-(--color-accent-muted)/85">
              {version}
            </span>
          )}
        </WButton>
        <AchievementSearch item={item} language={language} compact />
      </span>
      <span
        ref={descriptionRef}
        className="achievement-description text-[12px] leading-[1.5] wrap-anywhere whitespace-pre-line text-(--color-muted) group-data-[muted=true]/card:text-(--color-muted)/85 narrow:text-[11px]"
      >
        {description || t('ui.missingDescription')}
      </span>
    </span>
  )
}

export function AchievementCard({
  item,
  language,
  query,
  stages,
  exclusiveAlternative,
  disabled,
  onToggle,
  onOpenDetails,
}: {
  item: Achievement
  language: string
  query: string
  stages?: readonly Achievement[]
  exclusiveAlternative: boolean
  disabled: boolean
  onToggle: () => void
  onOpenDetails: () => void
}) {
  const { t: tr } = useTranslation()
  const roleRequirement = getAchievementRoles(item.id, language)
  const completed = isFinished(item)
  const { currentProgress, maxProgress } = item
  const showProgress =
    currentProgress !== null &&
    maxProgress !== null &&
    currentProgress !== maxProgress &&
    !(currentProgress === 0 && maxProgress === 1)
  const hiddenBadge = item.hidden && (
    <WTooltip text={tr('ui.hiddenBadge')}>
      <span
        className={`hidden-badge absolute grid size-4 cursor-default place-items-center text-(--color-muted) group-data-[muted=true]/card:opacity-35 ${roleRequirement ? 'pointer-events-auto top-2.5 right-[24%] narrow:top-2 narrow:right-6' : 'top-1.5 left-1.5'}`}
        onClick={(event) => event.stopPropagation()}
      >
        <WSvg name="achievement-hidden" size={12} />
      </span>
    </WTooltip>
  )
  return (
    <div
      className="achievement-card group/card relative isolate grid min-h-20 grid-cols-[64px_minmax(0,1fr)_max-content] items-center gap-5 px-[25px] py-1.5 compact:grid-cols-[52px_minmax(0,1fr)_max-content] compact:gap-[13px] compact:px-5 narrow:grid-cols-[44px_minmax(0,1fr)_max-content] narrow:gap-[9px] narrow:px-3.5 narrow:py-1"
      data-completed={completed}
      data-muted={completed || exclusiveAlternative}
    >
      <WButton
        className="achievement-row absolute inset-0 isolate rounded-lg focus-visible:outline-offset-[-3px] disabled:opacity-100"
        data-testid={`成就卡片 ${item.id}`}
        data-completed={completed}
        data-exclusive-alternative={exclusiveAlternative || undefined}
        disabled={disabled}
        onClick={onToggle}
      >
        <span className="pointer-events-none absolute inset-y-0 left-16 flex w-24 -translate-x-1/2 flex-col justify-center compact:left-[52px] compact:w-[92px] narrow:left-[47px] narrow:w-[88px]">
          <span className="relative block group-data-[muted=true]/card:[&>.achievement-emblem]:opacity-35 group-data-[muted=true]/card:[&>.achievement-emblem]:saturate-45">
            <AchievementEmblem {...getAchievementStars(item, stages)} />
            {completed && (
              <WTooltip text={tr('ui.finished')}>
                <span className="achievement-completed-mark pointer-events-auto absolute right-[28%] bottom-[15%] grid size-4 place-items-center text-(--color-muted)">
                  <WSvg name="check" size={14} strokeWidth={1.8} />
                </span>
              </WTooltip>
            )}
          </span>
          {roleRequirement && hiddenBadge}
        </span>
        {roleRequirement ? (
          <WTooltip
            text={tr(roleRequirement.requirementKey, {
              value0: roleRequirement.value0,
            })}
          >
            <span className="achievement-role-avatars absolute top-1.5 left-1.5 flex gap-0.5">
              {roleRequirement.avatars.map(({ id, avatarUrl }) => (
                <img
                  key={id}
                  data-role-id={id}
                  src={avatarUrl}
                  width={24}
                  height={24}
                  className="size-6 rounded-sm bg-(--color-surface-soft) object-contain group-data-[completed=true]/card:opacity-35 group-data-[completed=true]/card:saturate-45 narrow:size-5"
                  loading="lazy"
                  decoding="async"
                  alt=""
                />
              ))}
            </span>
          </WTooltip>
        ) : (
          hiddenBadge
        )}
      </WButton>
      <AchievementSummary
        item={item}
        language={language}
        query={query}
        onOpenDetails={onOpenDetails}
      />
      <span className="pointer-events-none z-10 col-start-3 flex items-center gap-3 whitespace-nowrap narrow:flex-col-reverse narrow:items-end narrow:gap-1">
        {showProgress && (
          <span className="row-progress font-mono text-[11px] text-(--color-muted) narrow:leading-tight">
            {currentProgress}/{maxProgress}
          </span>
        )}
        <span className="row-reward flex items-center gap-[7px] text-[12px] text-(--color-gold) group-data-[muted=true]/card:text-(--color-muted)/85 narrow:text-[11px]">
          <img
            src={astriteIcon}
            width={16}
            height={16}
            className="size-4 shrink-0 object-contain group-data-[muted=true]/card:opacity-35"
            alt=""
          />
          <span className="w-[2ch] shrink-0 text-left tabular-nums">{item.astrite}</span>
        </span>
      </span>
    </div>
  )
}
