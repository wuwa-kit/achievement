import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useViewerStore } from '../stores/viewer'

import { getAchievementRoles } from '../lib/achievement-roles'
import { isFinished, plainText, titleOf, type Achievement, type ExportData } from '../lib/data'
import astriteIcon from '../assets/achievement-icons/astrite.png?no-inline'
import { AchievementSearch } from './AchievementSearch'
import { useAchievementHighlight } from './useAchievementHighlight'
import { WDialog } from './ui/WDialog'
import { WScrollArea } from './ui/WScrollArea'
import { WButton } from './ui/WButton'
import { WCheckBox } from './ui/WCheckBox'
import { WTooltip } from './ui/WTooltip'
import { WSvg } from './ui/WSvg'

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
  const { busy, receiving, pendingImport, setAchievementCompleted } = useViewerStore(
    useShallow(({ busy, receiving, pendingImport, setAchievementCompleted }) => ({
      busy,
      receiving,
      pendingImport,
      setAchievementCompleted,
    })),
  )
  const completed = isFinished(item)
  const showManualProgress =
    data.uid === null && item.currentProgress === null && item.maxProgress === null
  const category = data.categories.find((category) => category.id === item.categoryId)
  const group = category?.groups.find((group) => group.id === item.groupId)
  const categoryFallback = tr('ui.categoryId', { value0: item.categoryId })
  const groupFallback = tr('ui.group', { value0: item.groupId })
  const roleRequirement = getAchievementRoles(item.id, language)
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
        {roleRequirement && (
          <div className="achievement-detail-roles mt-1 text-sm text-(--color-muted)">
            {tr(roleRequirement.requirementKey, { value0: roleRequirement.value0 })}
          </div>
        )}
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

export function AchievementDetailDialog({
  selectedId,
  open,
  onOpenChange,
  language,
  query,
}: {
  selectedId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  language: string
  query: string
}) {
  const data = useViewerStore((state) => state.data)
  const selected = data?.achievements.find((item) => item.id === selectedId)
  return (
    <WDialog
      className="detail-dialog w-[760px] overflow-hidden"
      open={open && !!selected}
      onOpenChange={onOpenChange}
      closeOnBackdrop
    >
      {selected && data && (
        <AchievementDetail
          item={selected}
          data={data}
          language={language}
          query={query}
          onClose={() => onOpenChange(false)}
        />
      )}
    </WDialog>
  )
}
