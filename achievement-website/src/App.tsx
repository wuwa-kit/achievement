import { formatDate } from './i18n/index.ts'
import { contentLanguageCodes } from './i18n/resources'
import { usePreferencesStore } from './stores/preferences'
import { useTranslation } from 'react-i18next'
import { WLanguageSwitch } from './components/ui/WLanguageSwitch'
import { useViewerStore } from './stores/viewer'
import { WThemeSwitch } from './components/ui/WThemeSwitch'
import { WTooltip } from './components/ui/WTooltip'
import { WOption } from './components/ui/WOption'
import { WSvg } from './components/ui/WSvg'
import { WScrollArea } from './components/ui/WScrollArea'
import { WSelect } from './components/ui/WSelect.tsx'
import { WInput } from './components/ui/WInput.tsx'
import { WButton } from './components/ui/WButton.tsx'
import { WIconButton } from './components/ui/WIconButton'
import { WCheckBox } from './components/ui/WCheckBox'
import { WDialog } from './components/ui/WDialog'
import { WConfirmDialog } from './components/ui/WConfirmDialog'
import { ArchiveActions } from './components/ArchiveActions'
import { CatalogStatistics } from './components/CatalogStatistics'
import { OpenSourceLink } from './components/OpenSourceLink'
import { ViewerLayout } from './components/ViewerLayout'
import { AchievementEmblem } from './components/AchievementEmblem'
import { AchievementList } from './components/AchievementList'
import { AchievementVersionFilter } from './components/AchievementVersionFilter'
import { useAchievementHighlight } from './components/useAchievementHighlight'
import { defaultArchiveKey } from './lib/archives'
import { achievementVersionById } from './lib/achievement-versions'
import { catalogExclusions, exclusiveAchievementGroups } from './lib/catalog'
import { exclusionReason } from './lib/exclusions'
import { WEllipsis } from './components/ui/WEllipsis'
import {
  achievementCategoryIcons,
  achievementGroupIcons,
  achievementTabIcon,
} from './lib/achievement-icons'
import astriteIcon from './assets/achievement-icons/astrite.png?no-inline'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  filterAchievements,
  getAchievementStars,
  getAchievementStages,
  getAchievementUnits,
  getExclusiveAchievements,
  isFinished,
  plainText,
  summarize,
  titleOf,
} from './lib/data.ts'
import type { Achievement, ExportData } from './lib/data.ts'
import './App.css'

const subtleButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-[5px] border px-4 py-2.5 text-[11px] font-medium whitespace-nowrap sidebar-overlay:px-[13px] sidebar-overlay:py-[9px] border-(--color-border) bg-(--color-surface) text-(--color-muted) hover:bg-(--color-surface-hover)'
const emptyStateClass =
  'flex flex-col items-center justify-center px-5 py-[70px] text-center text-(--color-muted)'
const emptyTitleClass = 'mb-2.5 text-[16px] text-(--color-text)'
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

function AchievementSearch({
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
          className="group/title pointer-events-auto min-w-0 rounded-sm text-left wrap-anywhere whitespace-pre-line"
          data-testid={`查看成就详情 ${item.id}`}
          onClick={onOpenDetails}
        >
          <span className="box-decoration-clone border-b border-transparent pb-0.5 group-hover/title:border-current group-focus-visible/title:border-current">
            <span ref={titleRef} className="achievement-title-text">
              {title || t('ui.missingTitle')}
            </span>
            {version && (
              <span className="achievement-version ms-0.5 align-super text-[0.72em] leading-none font-semibold whitespace-nowrap text-(--color-search-match) group-data-[muted=true]/card:text-(--color-accent-muted)/85">
                {version}
              </span>
            )}
          </span>
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

function AchievementDetail({
  item,
  data,
  language,
  query,
  onClose,
}: {
  item: Achievement
  data: ExportData
  language: string
  query: string
  onClose: () => void
}) {
  const { t: tr } = useTranslation()
  const { busy, receiving, pendingImport, setAchievementCompleted } = useViewerStore()
  const completed = isFinished(item)
  const showManualProgress =
    data.uid === null && item.currentProgress === null && item.maxProgress === null
  const category = data.categories.find((category) => category.id === item.categoryId)
  const group = category?.groups.find((group) => group.id === item.groupId)
  const categoryFallback = tr('ui.categoryId', { value0: item.categoryId })
  const groupFallback = tr('ui.group', { value0: item.groupId })
  const title = plainText(item.texts[language]?.title)
  const description = plainText(item.texts[language]?.description)
  const titleRef = useAchievementHighlight(title, query)
  const descriptionRef = useAchievementHighlight(description, query)
  return (
    <WScrollArea
      className="detail-scroll max-h-[calc(88dvh-2px)] overflow-auto"
      data-testid="成就详情内容"
    >
      <div className="detail-body px-[30px] py-7 narrow:p-[18px]">
        <div className="flex items-center gap-3">
          <span className="min-w-0 text-sm font-medium text-(--color-muted) [overflow-wrap:anywhere]">
            {category ? titleOf(category, language, categoryFallback) : categoryFallback}
            {' / '}
            {group ? titleOf(group, language, groupFallback) : groupFallback}
          </span>
          <span className="ms-auto shrink-0 font-mono text-[11px] text-(--color-muted)">
            #{item.id.toString()}
          </span>
          <WButton
            className="icon-button inline-grid size-8 shrink-0 place-items-center rounded-[5px] text-(--color-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text)"
            onClick={onClose}
            data-testid="关闭详情"
          >
            <WSvg name="x" size={20} />
          </WButton>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-1">
            <div className="ui-h2 min-w-0 text-2xl font-semibold [overflow-wrap:anywhere]">
              <span id="detail-title" ref={titleRef}>
                {title || tr('ui.missingTitle')}
              </span>
              {item.hidden && (
                <WTooltip text={tr('ui.hiddenBadge')}>
                  <span className="hidden-badge ms-2 inline-flex size-5 items-center justify-center align-middle text-(--color-muted)">
                    <WSvg name="achievement-hidden" size={18} />
                  </span>
                </WTooltip>
              )}
            </div>
            <AchievementSearch item={item} language={language} />
          </div>
          <span className="inline-flex h-8 shrink-0 items-center gap-1 text-xs font-medium text-(--color-gold)">
            <img
              src={astriteIcon}
              width={16}
              height={16}
              className="size-4 object-contain"
              alt=""
            />
            {item.astrite}
          </span>
        </div>
        <div
          ref={descriptionRef}
          className="ui-p mt-3 whitespace-pre-line leading-7 text-(--color-muted)"
        >
          {description || tr('ui.missingDescription')}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-(--color-border) pt-3 text-xs text-(--color-muted)">
          <span className="font-mono font-medium whitespace-nowrap text-(--color-text)">
            {showManualProgress
              ? `${Number(completed)}/1`
              : `${item.currentProgress ?? '—'}/${item.maxProgress ?? '—'}`}
          </span>
          <WCheckBox
            className="ms-auto whitespace-nowrap text-(--color-text)"
            data-testid="编辑成就完成状态"
            checked={completed}
            disabled={busy || receiving || !!pendingImport}
            onCheckedChange={(checked) => void setAchievementCompleted(item.id, checked)}
          >
            {tr('ui.finished')}
          </WCheckBox>
        </div>
      </div>
    </WScrollArea>
  )
}

export default function App() {
  const { t: tr } = useTranslation()
  const {
    ticket,
    receiving,
    receipt,
    data,
    archives,
    activeKey,
    pendingImport,
    pendingExclusiveId,
    busy,
    setAchievementCompleted,
    filters: storedFilters,
    hiddenCompletedIds,
    revision,
    update,
    importFile,
    receive,
    cancelReceive,
    switchAccount,
    confirmImport,
    confirmExclusiveAchievement,
    connect,
  } = useViewerStore()
  const language = usePreferencesStore((state) => state.language)
  const filters = useMemo(
    () => ({ ...storedFilters, language: contentLanguageCodes[language] }),
    [storedFilters, language],
  )
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const selected = data?.achievements.find((item) => item.id === selectedId) ?? null
  const pendingExclusive = data?.achievements.find((item) => item.id === pendingExclusiveId)
  const fileInput = useRef<HTMLInputElement>(null)
  const deferredQuery = useDeferredValue(filters.query)
  const highlightQuery = deferredQuery.trim().toLocaleLowerCase()
  useEffect(connect, [connect])
  useEffect(() => {
    setDetailOpen(false)
    setSelectedId(null)
  }, [revision])
  function navigate(group: number | null) {
    if (filters.group !== group) update({ group })
    setNavigationOpen(false)
  }
  const mainItems = useMemo(
    () => data?.achievements.filter((a) => a.inMainMenu && !exclusionReason(a)) ?? [],
    [data],
  )
  const stagesById = useMemo(() => getAchievementStages(mainItems), [mainItems])
  const exclusiveById = useMemo(
    () => getExclusiveAchievements(mainItems, exclusiveAchievementGroups),
    [mainItems],
  )
  const excludedItems = useMemo(
    () => catalogExclusions.filter(({ id }) => !mainItems.some((item) => item.id === id)),
    [mainItems],
  )
  const exclusiveGroups = useMemo(() => [...new Set(exclusiveById.values())], [exclusiveById])
  const units = useMemo(
    () => getAchievementUnits(mainItems, exclusiveById),
    [mainItems, exclusiveById],
  )
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
  const defaultArchive = archives.find((archive) => archive.key === defaultArchiveKey)
  const versionItems = useMemo(() => {
    if (!filters.versions.length) return mainItems
    const versions = new Set(filters.versions)
    return mainItems.filter(({ id }) => versions.has(achievementVersionById.get(id) ?? ''))
  }, [mainItems, filters.versions])
  const matches = useMemo(
    () =>
      filterAchievements(
        versionItems,
        { ...filters, query: deferredQuery },
        stagesById,
        hiddenCompletedIds,
        exclusiveById,
      ),
    [versionItems, filters, deferredQuery, stagesById, hiddenCompletedIds, exclusiveById],
  )
  return (
    <ViewerLayout>
      {navigationOpen && (
        <WButton
          className="nav-scrim fixed inset-0 z-[29] hidden bg-(--color-scrim) sidebar-overlay:block"
          data-testid="收起导航"
          onClick={() => setNavigationOpen(false)}
        />
      )}
      <WScrollArea
        className="sidebar fixed! inset-y-0 left-0 z-30 flex w-(--sidebar-width) flex-col overflow-y-auto bg-(--color-nav-page) px-[18px] pt-[30px] pb-[22px] text-(--color-nav-muted) [--category-inset:6px] [--color-focus:var(--color-nav-gold)] [--nav-gap:10px] [--nav-inset:12px] compact:px-3.5 sidebar-overlay:w-[min(var(--sidebar-width),calc(100vw-40px))] sidebar-overlay:[transform:translateX(-100%)] sidebar-overlay:transition-transform sidebar-overlay:duration-200 sidebar-overlay:data-[open=true]:[transform:translateX(0)]"
        data-open={navigationOpen}
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
              language={filters.language}
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
            data-selected={filters.group === null}
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
                    <img src={icon} width={17} height={17} className="justify-self-center" alt="" />
                  ) : (
                    <span />
                  )}
                  <WEllipsis className="nav-label">
                    {titleOf(
                      category,
                      filters.language,
                      tr('ui.categoryId', { value0: category.id }),
                    )}
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
                        data-selected={filters.group === group.id}
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
                          {titleOf(group, filters.language, tr('ui.group', { value0: group.id }))}
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

      <div className="workspace ml-(--sidebar-width) flex h-dvh flex-col overflow-hidden sidebar-overlay:ml-0 sidebar-overlay:bg-none">
        <div className="topbar flex h-[69px] flex-none items-center justify-between gap-3 border-b border-b-(--line) bg-(--color-surface) px-10 compact:px-[25px] narrow:h-[60px] narrow:gap-1.5 narrow:px-3.5">
          <div className="topbar-records flex min-w-0 items-center gap-2 narrow:gap-1">
            <WIconButton
              variant="ghost"
              className="icon-button mobile-menu text-(--color-muted) hover:text-(--color-text) min-[901px]:hidden"
              data-testid="打开导航"
              onClick={() => setNavigationOpen(true)}
            >
              <WSvg name="menu" size={20} />
            </WIconButton>
            <WSelect
              className="topbar-account narrow:[--select-gap:4px] narrow:[--select-px:6px] narrow:[&_.archive-account-time]:hidden"
              data-testid="账号档案"
              value={activeKey}
              disabled={busy || receiving}
              onValueChange={(value) => void switchAccount(value)}
            >
              <WOption value={defaultArchiveKey}>
                {tr('common.defaultAccount')}
                {defaultArchive && (
                  <span className="archive-account-time">
                    {' · ' + formatDate(defaultArchive.capturedAt)}
                  </span>
                )}
              </WOption>
              {archives
                .filter((a) => a.uid)
                .map((a) => (
                  <WOption key={a.key} value={a.key}>
                    {'UID ' + a.uid}
                    <span className="archive-account-time">{' · ' + formatDate(a.capturedAt)}</span>
                  </WOption>
                ))}
            </WSelect>
            <WTooltip text={tr('ui.importAchievementFile')}>
              <WIconButton
                className="topbar-icon text-(--color-accent)"
                data-testid="import-achievement-file"
                onClick={() => fileInput.current?.click()}
                disabled={busy || receiving}
              >
                <WSvg name="upload" size={20} />
              </WIconButton>
            </WTooltip>
            <WInput
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              data-testid="导入成就 JSON 文件"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                void importFile(file)
              }}
            />
            <ArchiveActions />
          </div>
          <div className="topbar-actions flex flex-none items-center gap-2 narrow:gap-1">
            <WThemeSwitch />
            <WLanguageSwitch />
            <OpenSourceLink />
          </div>
        </div>
        <div className="main-content mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-10 pb-4 compact:px-[25px] narrow:px-3.5 narrow:pb-2.5">
          {ticket && receipt && !busy && !receiving && (
            <div className="ui-section my-4 flex flex-wrap items-center gap-3 rounded-lg border border-(--color-border) bg-(--color-surface) px-4 py-3">
              <div className="ui-p flex-1 text-sm text-(--color-muted)">{tr('ui.ackRetry')}</div>
              <WButton
                className="rounded-md border border-(--color-border) px-3 py-2 text-sm hover:bg-(--color-surface-hover)"
                onClick={() => void receive()}
              >
                {tr('ui.retryAck')}
              </WButton>
            </div>
          )}
          {!data && busy ? null : !data ? (
            <div className={`ui-section empty-state mt-8 ${emptyStateClass}`}>
              <WSvg name="file-json" size={42} />
              <div className={`ui-h2 mt-5 ${emptyTitleClass}`}>{tr('ui.startArchive')}</div>
              <div className="ui-p text-[12px] leading-[1.8]">{tr('ui.startHint')}</div>
              <WButton
                className="button primary mt-4 inline-flex items-center justify-center gap-2 rounded-[5px] border px-4 py-2.5 text-[11px] font-medium whitespace-nowrap sidebar-overlay:px-[13px] sidebar-overlay:py-[9px] border-(--color-accent) bg-(--color-accent) text-(--color-on-accent) shadow-[0_2px_3px] shadow-(color:--color-shadow)/5 hover:bg-(--color-accent-hover)"
                onClick={() => fileInput.current?.click()}
              >
                {tr('ui.importAchievementFile')}
              </WButton>
            </div>
          ) : (
            <div className="ui-section achievement-panel flex min-h-0 flex-1 flex-col">
              <div className="filter-bar flex flex-none items-center gap-2.5 py-3.5 narrow:flex-wrap narrow:gap-[7px] narrow:py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5 narrow:basis-full narrow:gap-[7px]">
                  <div className="search-field flex h-9 min-w-0 flex-1 items-center gap-[9px] rounded-sm border border-(--line) bg-(--color-surface) px-3 text-(--color-muted) focus-within:border-(--input-focus) focus-within:shadow-[0_0_0_3px_var(--input-focus-ring)] motion-safe:w-transition-colors">
                    <WSvg name="search" size={18} />
                    <WInput
                      variant="embedded"
                      className="flex-1 text-(--color-text) placeholder:text-(--color-muted)"
                      data-testid="搜索成就"
                      placeholder={tr('ui.search')}
                      value={filters.query}
                      onChange={(event) => update({ query: event.target.value })}
                    />
                    {filters.query && (
                      <WButton
                        className="icon-button search-clear inline-grid size-6 flex-none place-items-center rounded-[5px] text-(--color-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text)"
                        data-testid="清空搜索"
                        onClick={() => update({ query: '' })}
                      >
                        <WSvg name="x" size={14} />
                      </WButton>
                    )}
                  </div>
                  <AchievementVersionFilter
                    versions={filters.versions}
                    onVersionsChange={(versions) => update({ versions })}
                  />
                </div>
                <div className="flex items-center gap-2.5 narrow:ml-auto narrow:max-w-full narrow:gap-[7px] narrow:[--checkbox-px:4px] narrow:[--checkbox-text:11px]">
                  <WCheckBox
                    data-testid="只看隐藏成就"
                    checked={filters.visibility === 'hidden'}
                    onCheckedChange={(checked) =>
                      update({ visibility: checked ? 'hidden' : 'all' })
                    }
                  >
                    {tr('ui.hiddenOnly')}
                  </WCheckBox>
                  <WCheckBox
                    className="hide-completed"
                    data-testid="隐藏已完成"
                    checked={filters.hideCompleted}
                    onCheckedChange={(hideCompleted) => update({ hideCompleted })}
                  >
                    {tr('ui.hideCompleted')}
                  </WCheckBox>
                </div>
              </div>
              <AchievementList
                items={matches}
                exclusiveById={exclusiveById}
                stagesById={stagesById}
                resetKey={JSON.stringify([
                  revision,
                  deferredQuery,
                  filters.group,
                  filters.hideCompleted,
                  filters.visibility,
                  filters.versions,
                ])}
                renderItem={(item) => {
                  const stages = stagesById.get(item.id)
                  const completed = isFinished(item)
                  const exclusiveAlternative =
                    !completed && (exclusiveById.get(item.id)?.some(isFinished) ?? false)
                  const { currentProgress, maxProgress } = item
                  const showProgress =
                    currentProgress !== null &&
                    maxProgress !== null &&
                    currentProgress !== maxProgress &&
                    !(currentProgress === 0 && maxProgress === 1)
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
                        disabled={receiving || !!pendingImport || busy}
                        onClick={() => void setAchievementCompleted(item.id, !completed)}
                      >
                        <span className="pointer-events-none absolute top-1/2 left-16 w-24 -translate-1/2 compact:left-[52px] compact:w-[92px] narrow:left-[47px] narrow:w-[88px] group-data-[muted=true]/card:[&>.achievement-emblem]:opacity-35 group-data-[muted=true]/card:[&>.achievement-emblem]:saturate-45">
                          <AchievementEmblem {...getAchievementStars(item, stages)} />
                          {completed && (
                            <WTooltip text={tr('ui.finished')}>
                              <span className="achievement-completed-mark pointer-events-auto absolute right-[28%] bottom-[15%] grid size-4 place-items-center text-(--color-muted)">
                                <WSvg name="check" size={14} strokeWidth={1.8} />
                              </span>
                            </WTooltip>
                          )}
                        </span>
                      </WButton>
                      {item.hidden && (
                        <WTooltip text={tr('ui.hiddenBadge')}>
                          <span className="hidden-badge absolute top-1.5 left-1.5 z-10 grid size-4 place-items-center text-(--color-muted) group-data-[muted=true]/card:opacity-35">
                            <WSvg name="achievement-hidden" size={12} />
                          </span>
                        </WTooltip>
                      )}
                      <AchievementSummary
                        item={item}
                        language={filters.language}
                        query={highlightQuery}
                        onOpenDetails={() => {
                          setSelectedId(item.id)
                          setDetailOpen(true)
                        }}
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
                          <span className="w-[2ch] shrink-0 text-left tabular-nums">
                            {item.astrite}
                          </span>
                        </span>
                      </span>
                    </div>
                  )
                }}
              >
                <div className={`empty-state ${emptyStateClass}`}>
                  <div className={`ui-h3 ${emptyTitleClass}`}>{tr('ui.noMatches')} </div>
                  <div className="ui-p text-[12px] leading-[1.8]">{tr('ui.noMatchesHint')} </div>
                  <WButton
                    className={`button subtle mt-3 ${subtleButtonClass}`}
                    onClick={() =>
                      update({
                        query: '',
                        group: null,
                        hideCompleted: false,
                        visibility: 'all',
                        versions: [],
                      })
                    }
                  >
                    {tr('ui.clearFilters')}{' '}
                  </WButton>
                </div>
              </AchievementList>
            </div>
          )}
        </div>
      </div>
      <WDialog
        className="detail-dialog w-[760px] overflow-hidden"
        open={detailOpen && !!selected}
        onOpenChange={setDetailOpen}
        closeOnBackdrop
      >
        {selected && data && (
          <AchievementDetail
            item={selected}
            data={data}
            language={filters.language}
            query={highlightQuery}
            onClose={() => setDetailOpen(false)}
          />
        )}
      </WDialog>
      <WConfirmDialog
        open={!!pendingExclusive}
        heading={tr('ui.exclusiveChange')}
        message={tr('ui.exclusiveChangePrompt', {
          value0: pendingExclusive
            ? titleOf(pendingExclusive, filters.language, tr('ui.missingTitle'))
            : '',
        })}
        cancelLabel={tr('common.cancel')}
        confirmLabel={tr('ui.exclusiveChange')}
        testId="confirm-exclusive-achievement"
        confirmTestId="change-exclusive-achievement"
        onOpenChange={(open) => {
          if (!open) confirmExclusiveAchievement(false)
        }}
        onConfirm={() => confirmExclusiveAchievement(true)}
      />
      <WConfirmDialog
        open={!!ticket && !receipt && !pendingImport}
        heading={tr('ui.receiveDesktop')}
        message={tr('ui.receivePrompt')}
        cancelLabel={tr('common.cancel')}
        confirmLabel={receiving ? tr('ui.receiving') : tr('ui.confirmReceive')}
        loading={busy || receiving}
        testId="desktop-import-dialog"
        cancelTestId="cancel-desktop-import"
        confirmTestId="confirm-desktop-import"
        onConfirm={() => void receive()}
        onOpenChange={(open) => {
          if (!open) cancelReceive()
        }}
      />
      <WConfirmDialog
        open={!!pendingImport}
        heading={tr('ui.olderArchiveTitle')}
        message={
          pendingImport
            ? tr('ui.olderArchivePrompt', {
                incoming: formatDate(pendingImport.data.capturedAt),
                existing: formatDate(pendingImport.existingTime),
              })
            : ''
        }
        cancelLabel={tr('ui.keepLocalArchive')}
        confirmLabel={tr('ui.replaceArchive')}
        confirmTone="danger"
        loading={busy}
        testId="旧档案导入确认"
        cancelTestId="取消导入旧档案"
        confirmTestId="确认导入旧档案"
        onConfirm={() => void confirmImport(true)}
        onOpenChange={(open) => {
          if (!open) void confirmImport(false)
        }}
      />
    </ViewerLayout>
  )
}
