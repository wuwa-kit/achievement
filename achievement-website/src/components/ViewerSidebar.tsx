import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useViewerStore } from '../stores/viewer'
import { contentLanguageCodes } from '../i18n/resources'
import { usePreferencesStore } from '../stores/preferences'

import { catalogExclusions } from '../lib/catalog'
import { isFinished, summarize, titleOf } from '../lib/data'
import {
  achievementCategoryIcons,
  achievementGroupIcons,
  achievementTabIcon,
} from '../lib/achievement-icons'
import astriteIcon from '../assets/achievement-icons/astrite.png?no-inline'
import { CatalogStatistics } from './CatalogStatistics'
import type { ViewerCatalog } from './useViewerCatalog'
import { WEllipsis } from './ui/WEllipsis'
import { WButton } from './ui/WButton'
import { WScrollArea } from './ui/WScrollArea'
import { WTooltip } from './ui/WTooltip'
import { WSvg } from './ui/WSvg'

const sidebarNavColumns = 'grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-(--nav-gap)'

function Mark() {
  return (
    <img
      className="archive-mark shrink-0 object-contain"
      src={achievementTabIcon}
      width={46}
      height={46}
      alt=""
    />
  )
}

function NavProgress({
  countClass,
  finished,
  total,
  alwaysShowCount,
}: {
  countClass: string
  finished?: number
  total?: number
  alwaysShowCount?: boolean
}) {
  const { t } = useTranslation()
  const completed = total !== undefined && total > 0 && finished === total

  return (
    <span className="nav-progress inline-flex flex-none items-center">
      {completed && !alwaysShowCount ? (
        <WTooltip text={t('ui.finished')}>
          <WSvg
            className="nav-completion-icon text-(--color-nav-gold)"
            name="check"
            size={14}
            strokeWidth={2.5}
          />
        </WTooltip>
      ) : (
        <span className={`nav-count font-mono text-[11px] whitespace-nowrap ${countClass}`}>
          {finished ?? '—'}/{total ?? '—'}
        </span>
      )}
    </span>
  )
}

export function ViewerSidebar({
  catalog,
  open,
  onClose,
}: {
  catalog: ViewerCatalog
  open: boolean
  onClose: () => void
}) {
  const { data, mainItems, exclusiveById, units } = catalog
  const { t: tr } = useTranslation()
  const selectedGroup = useViewerStore((state) => state.filters.group)
  const update = useViewerStore((state) => state.update)
  const language = usePreferencesStore((state) => contentLanguageCodes[state.language])
  function navigate(nextGroup: number | null) {
    if (selectedGroup !== nextGroup) update({ group: nextGroup })
    onClose()
  }
  const excludedItems = useMemo(
    () => catalogExclusions.filter(({ id }) => !mainItems.some((item) => item.id === id)),
    [mainItems],
  )
  const exclusiveGroups = useMemo(() => [...new Set(exclusiveById.values())], [exclusiveById])
  const summary = useMemo(() => summarize(mainItems, exclusiveById), [mainItems, exclusiveById])
  const { categoryCounts, groupCounts } = useMemo(() => {
    function countBy(key: 'categoryId' | 'groupId') {
      const counts = new Map<number, { finished: number; total: number }>()
      for (const members of units) {
        const finished = Number(members.some(isFinished))
        for (const id of new Set(members.map((item) => item[key]))) {
          const count = counts.get(id) ?? { finished: 0, total: 0 }
          count.total++
          count.finished += finished
          counts.set(id, count)
        }
      }
      return counts
    }
    return { categoryCounts: countBy('categoryId'), groupCounts: countBy('groupId') }
  }, [units])

  return (
    <>
      {open && (
        <WButton
          className="nav-scrim fixed inset-0 z-[29] hidden bg-(--color-scrim) sidebar-overlay:block"
          data-testid="收起导航"
          onClick={() => onClose()}
        />
      )}
      <div
        className="sidebar fixed inset-y-0 left-0 z-30 w-(--sidebar-width) overflow-hidden bg-(--color-nav-page) sidebar-overlay:w-[min(var(--sidebar-width),calc(100vw-40px))] sidebar-overlay:[transform:translateX(-100%)] sidebar-overlay:transition-transform sidebar-overlay:duration-200 sidebar-overlay:data-[open=true]:[transform:translateX(0)]"
        data-open={open}
      >
        <WScrollArea
          className="sidebar-scroll relative flex h-full w-full flex-col overflow-y-auto px-[18px] pt-[30px] pb-[22px] text-(--color-nav-muted) [--category-inset:6px] [--color-focus:var(--color-nav-gold)] [--nav-gap:10px] [--nav-inset:12px] compact:px-3.5"
          data-testid="成就分类导航"
        >
          <div className="mx-2 mt-[3px] mb-7 flex items-center gap-2">
            <a
              className="brand flex min-w-0 flex-1 items-center gap-(--nav-gap) text-[20px] font-semibold tracking-[1px] text-(--color-nav-text) no-underline"
              href="#"
              onClick={(event) => {
                event.preventDefault()
                navigate(null)
              }}
            >
              <Mark />
              <span className="brand-text min-w-0">
                <WEllipsis>{tr('ui.brand')}</WEllipsis>
                <WEllipsis className="brand-sub mt-1 text-[11px] font-normal tracking-[1px] text-(--color-nav-muted)">
                  {tr('ui.brandSub')}
                </WEllipsis>
              </span>
            </a>
            {data && (
              <CatalogStatistics
                language={language}
                includedTotal={mainItems.length}
                excludedItems={excludedItems}
                exclusiveGroups={exclusiveGroups}
                achievableTotal={summary.total}
                astrite={summary.astrite}
              />
            )}
          </div>
          <div className="nav-overview rounded-lg border border-(--color-nav-border) bg-(--color-nav-surface) p-1 pl-[calc(var(--overview-frame)-1px)] [--overview-frame:3px] [--overview-inset:calc(var(--nav-inset)-4px)] [--overview-start:calc(var(--category-inset)-var(--overview-frame))]">
            <WButton
              className={`nav-overview-heading ${sidebarNavColumns} w-full rounded-sm py-[9px] pr-(--overview-inset) pl-(--overview-start) text-start text-[13px] font-semibold text-(--color-nav-muted) hover:bg-(--color-nav-hover) data-[selected=true]:bg-(--color-nav-selection) data-[selected=true]:text-(--color-nav-gold) data-[selected=true]:shadow-[inset_3px_0_var(--color-nav-gold)]`}
              data-selected={selectedGroup === null}
              onClick={() => navigate(null)}
            >
              <img src={achievementTabIcon} width={18} height={18} alt="" />
              <WEllipsis className="nav-label flex-1">{tr('ui.overview')}</WEllipsis>
              <NavProgress
                countClass="text-inherit"
                finished={data ? summary.finished : undefined}
                total={data ? summary.total : undefined}
                alwaysShowCount
              />
            </WButton>
            {data && (
              <div
                className="archive-summary mt-px mr-(--overview-inset) mb-2.5 ml-(--overview-start) grid gap-2 border-t border-(--color-nav-border) pt-2.5 text-[11px] text-(--color-nav-muted)"
                data-testid="成就统计"
              >
                {[
                  {
                    label: tr('ui.astrite'),
                    image: astriteIcon,
                    current: summary.completedAstrite,
                    total: summary.astrite,
                    testId: 'completed-astrite',
                  },
                  {
                    label: tr('ui.hidden'),
                    current: units.filter(
                      (members) => members.some((item) => item.hidden) && members.some(isFinished),
                    ).length,
                    total: summary.hidden,
                    testId: 'completed-hidden',
                  },
                ].map(({ label, image, current, total, testId }) => (
                  <div className={`archive-summary-item ${sidebarNavColumns}`} key={testId}>
                    {image ? (
                      <img
                        src={image}
                        width={14}
                        height={14}
                        className="size-3.5 justify-self-center object-contain"
                        alt=""
                      />
                    ) : (
                      <WSvg name="achievement-hidden" size={14} className="justify-self-center" />
                    )}
                    <WEllipsis className="nav-label flex-1">{label}</WEllipsis>
                    <span className="archive-summary-value font-mono whitespace-nowrap tabular-nums">
                      <span
                        className="archive-summary-current font-semibold text-(--color-nav-text)"
                        data-testid={testId}
                      >
                        {current.toString()}
                      </span>
                      <span className="archive-summary-total text-(--color-nav-muted)">
                        /{total.toString()}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="category-navigation mt-3">
            {data?.categories.map((category) => {
              const icon = achievementCategoryIcons[category.id]
              const { finished = 0, total = 0 } = categoryCounts.get(category.id) ?? {}
              return (
                <div key={category.id}>
                  <div
                    className={`category-nav-row ${sidebarNavColumns} pt-2.5 pr-(--nav-inset) pb-1.5 pl-(--category-inset) text-[12px] text-(--color-nav-section)`}
                  >
                    {icon ? (
                      <img
                        src={icon}
                        width={17}
                        height={17}
                        className="justify-self-center"
                        alt=""
                      />
                    ) : (
                      <span />
                    )}
                    <WEllipsis className="nav-label">
                      {titleOf(category, language, tr('ui.categoryId', { value0: category.id }))}
                    </WEllipsis>
                    <NavProgress
                      finished={finished}
                      total={total}
                      countClass="text-(--color-nav-muted)"
                    />
                  </div>
                  <div className="sub-navigation mt-0.5 mr-1.5 mb-2.5 ml-[calc(var(--category-inset)+8px)] border-l-(length:--sub-nav-line-width) border-l-(--color-nav-border) pl-(--sub-nav-inset) [--sub-nav-inset:10px] [--sub-nav-line-width:1px]">
                    {category.groups.map((group) => {
                      const icon = achievementGroupIcons[group.id]
                      const { finished = 0, total = 0 } = groupCounts.get(group.id) ?? {}
                      return (
                        <WButton
                          key={group.id}
                          data-selected={selectedGroup === group.id}
                          onClick={() => navigate(group.id)}
                          className="relative flex w-full items-center gap-(--nav-gap) rounded-sm px-2 py-1.5 text-left text-[11px] leading-[1.7] text-(--color-nav-muted) hover:bg-(--color-nav-hover) hover:text-(--color-nav-gold) data-[selected=true]:bg-(--color-nav-selection) data-[selected=true]:text-(--color-nav-gold)"
                        >
                          {icon && (
                            <img
                              src={icon}
                              width={15}
                              height={15}
                              className="group-icon shrink-0"
                              alt=""
                            />
                          )}
                          <WEllipsis className="nav-label flex-1">
                            {titleOf(group, language, tr('ui.group', { value0: group.id }))}
                          </WEllipsis>
                          <NavProgress
                            finished={finished}
                            total={total}
                            countClass="text-inherit opacity-85"
                          />
                        </WButton>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </WScrollArea>
      </div>
    </>
  )
}
