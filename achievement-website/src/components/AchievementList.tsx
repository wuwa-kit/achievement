import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isFinished, type Achievement } from '../lib/data'
import { WScrollArea } from './ui/WScrollArea'

type AchievementRow = {
  members: Achievement[]
  related?: readonly Achievement[]
  cardIndex: number
}

export function AchievementList({
  items,
  exclusiveById,
  stagesById,
  resetKey,
  renderItem,
  children,
}: {
  items: Achievement[]
  exclusiveById: ReadonlyMap<number, readonly Achievement[]>
  stagesById: ReadonlyMap<number, readonly Achievement[]>
  resetKey: string
  renderItem: (item: Achievement) => ReactNode
  children: ReactNode
}) {
  const { t } = useTranslation()
  const viewport = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => {
    const rows: AchievementRow[] = []
    for (const [cardIndex, item] of items.entries()) {
      const related = exclusiveById.get(item.id) ?? stagesById.get(item.id)
      const previous = rows.at(-1)
      if (related && previous?.related === related) previous.members.push(item)
      else rows.push({ members: [item], related, cardIndex })
    }
    return rows
  }, [items, exclusiveById, stagesById])
  const getItemKey = useCallback((index: number) => rows[index].members[0].id, [rows])
  const estimateSize = useCallback(
    (index: number) => {
      const { members, related } = rows[index]
      return 80 * members.length + (related ? 35 + 3 * (members.length - 1) : 0)
    },
    [rows],
  )
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => viewport.current,
    getItemKey,
    estimateSize,
    gap: 6,
    paddingStart: 3,
    paddingEnd: 3,
    overscan: 6,
    useAnimationFrameWithResizeObserver: true,
  })

  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0
  }, [resetKey])

  return (
    <WScrollArea
      ref={viewport}
      className="achievement-list min-h-0 flex-1 overflow-auto overscroll-contain [overflow-anchor:none]"
      data-testid="成就列表"
      data-count={items.length}
    >
      {items.length ? (
        <div
          className="achievement-list-content relative"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map(({ key, index, start }) => {
            const { members, related, cardIndex } = rows[index]
            const exclusive = exclusiveById.has(members[0].id)
            const label = exclusive
              ? related?.length === 2
                ? 'ui.exclusivePair'
                : 'ui.exclusiveChoice'
              : 'ui.stageAchievements'
            return (
              <div
                key={key}
                ref={virtualizer.measureElement}
                data-index={index}
                data-card-index={related ? undefined : cardIndex}
                className="absolute inset-x-0 top-0"
                style={{ transform: `translateY(${start}px)` }}
              >
                {related ? (
                  <div
                    className="flex flex-col gap-[3px] rounded-lg border border-(--color-border) bg-(--color-surface-soft) p-[3px]"
                    data-testid={`${exclusive ? 'exclusive' : 'stage'}-achievements-${related[0].id}`}
                  >
                    <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-0.5 text-xs font-medium text-(--color-muted)">
                      <span>{t(label)}</span>
                      {!exclusive && (
                        <span className="shrink-0 font-mono text-[11px] tabular-nums">
                          {related.filter(isFinished).length}/{related.length}
                        </span>
                      )}
                    </div>
                    {members.map((item, offset) => (
                      <div key={item.id} data-card-index={cardIndex + offset}>
                        {renderItem(item)}
                      </div>
                    ))}
                  </div>
                ) : (
                  renderItem(members[0])
                )}
              </div>
            )
          })}
        </div>
      ) : (
        children
      )}
    </WScrollArea>
  )
}
