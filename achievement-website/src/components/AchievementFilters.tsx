import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useViewerStore } from '../stores/viewer'

import { AchievementVersionFilter } from './AchievementVersionFilter'
import { WButton } from './ui/WButton'
import { WCheckBox } from './ui/WCheckBox'
import { WInput } from './ui/WInput'
import { WSvg } from './ui/WSvg'

export function AchievementFilters({
  versionCounts,
}: {
  versionCounts: ReadonlyMap<string, number>
}) {
  const { t: tr } = useTranslation()
  const { filters, update } = useViewerStore(
    useShallow(({ filters, update }) => ({ filters, update })),
  )
  return (
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
          versionCounts={versionCounts}
          onVersionsChange={(versions) => update({ versions })}
        />
      </div>
      <div className="flex items-center gap-2.5 narrow:ml-auto narrow:max-w-full narrow:gap-[7px] narrow:[--checkbox-px:4px] narrow:[--checkbox-text:11px]">
        <WCheckBox
          data-testid="只看隐藏成就"
          checked={filters.visibility === 'hidden'}
          onCheckedChange={(checked) => update({ visibility: checked ? 'hidden' : 'all' })}
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
  )
}
