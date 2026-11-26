import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useViewerStore } from '../stores/viewer'
import { contentLanguageCodes } from '../i18n/resources'
import { usePreferencesStore } from '../stores/preferences'

import { achievementVersionById } from '../lib/achievement-versions'
import { filterAchievements, isFinished } from '../lib/data'
import { AchievementFilters } from './AchievementFilters'
import { AchievementList } from './AchievementList'
import { AchievementCard } from './AchievementCard'
import { AchievementDetailDialog } from './AchievementDetailDialog'
import { ViewerReceiveStatus } from './ViewerImportDialogs'
import type { ViewerCatalog } from './useViewerCatalog'
import { WButton } from './ui/WButton'
import { WSvg } from './ui/WSvg'

const subtleButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-[5px] border px-4 py-2.5 text-[11px] font-medium whitespace-nowrap sidebar-overlay:px-[13px] sidebar-overlay:py-[9px] border-(--color-border) bg-(--color-surface) text-(--color-muted) hover:bg-(--color-surface-hover)'
const emptyStateClass =
  'flex flex-col items-center justify-center px-5 py-[70px] text-center text-(--color-muted)'
const emptyTitleClass = 'mb-2.5 text-[16px] text-(--color-text)'

export function ViewerAchievements({
  catalog,
  onImport,
}: {
  catalog: ViewerCatalog
  onImport: () => void
}) {
  const { data, mainItems, stagesById, exclusiveById, units } = catalog
  const { t: tr } = useTranslation()
  const {
    busy,
    receiving,
    pendingImport,
    setAchievementCompleted,
    filters: storedFilters,
    hiddenCompletedIds,
    revision,
    update,
  } = useViewerStore(
    useShallow(
      ({
        busy,
        receiving,
        pendingImport,
        setAchievementCompleted,
        filters,
        hiddenCompletedIds,
        revision,
        update,
      }) => ({
        busy,
        receiving,
        pendingImport,
        setAchievementCompleted,
        filters,
        hiddenCompletedIds,
        revision,
        update,
      }),
    ),
  )
  const language = usePreferencesStore((state) => contentLanguageCodes[state.language])
  const filters = useMemo(() => ({ ...storedFilters, language }), [storedFilters, language])
  const deferredQuery = useDeferredValue(filters.query)
  const highlightQuery = deferredQuery.trim().toLocaleLowerCase()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  useEffect(() => {
    setDetailOpen(false)
    setSelectedId(null)
  }, [revision])
  const versionCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const members of units) {
      const versions = new Set(members.map(({ id }) => achievementVersionById.get(id)))
      for (const version of versions) {
        if (version) counts.set(version, (counts.get(version) ?? 0) + 1)
      }
    }
    return counts
  }, [units])
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
    <>
      <div className="main-content mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-10 pb-4 compact:px-[25px] narrow:px-3.5 narrow:pb-2.5">
        <ViewerReceiveStatus />
        {!data && busy ? null : !data ? (
          <div className={`ui-section empty-state mt-8 ${emptyStateClass}`}>
            <WSvg name="file-json" size={42} />
            <div className={`ui-h2 mt-5 ${emptyTitleClass}`}>{tr('ui.startArchive')}</div>
            <div className="ui-p text-[12px] leading-[1.8]">{tr('ui.startHint')}</div>
            <WButton
              className="button primary mt-4 inline-flex items-center justify-center gap-2 rounded-[5px] border px-4 py-2.5 text-[11px] font-medium whitespace-nowrap sidebar-overlay:px-[13px] sidebar-overlay:py-[9px] border-(--color-accent) bg-(--color-accent) text-(--color-on-accent) shadow-[0_2px_3px] shadow-(color:--color-shadow)/5 hover:bg-(--color-accent-hover)"
              onClick={onImport}
            >
              {tr('ui.importAchievementFile')}
            </WButton>
          </div>
        ) : (
          <div className="ui-section achievement-panel flex min-h-0 flex-1 flex-col">
            <AchievementFilters versionCounts={versionCounts} />
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
              renderItem={(item) => (
                <AchievementCard
                  item={item}
                  language={filters.language}
                  query={highlightQuery}
                  stages={stagesById.get(item.id)}
                  exclusiveAlternative={
                    !isFinished(item) && (exclusiveById.get(item.id)?.some(isFinished) ?? false)
                  }
                  disabled={receiving || !!pendingImport || busy}
                  onToggle={() => void setAchievementCompleted(item.id, !isFinished(item))}
                  onOpenDetails={() => {
                    setSelectedId(item.id)
                    setDetailOpen(true)
                  }}
                />
              )}
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

      <AchievementDetailDialog
        selectedId={selectedId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        language={filters.language}
        query={highlightQuery}
      />
    </>
  )
}
