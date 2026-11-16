import { useVirtualizer } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Achievement } from '../lib/data'
import { WScrollArea } from './ui/WScrollArea'

const estimateCardHeight = () => 80

export function AchievementList({
  items,
  resetKey,
  renderItem,
  children,
}: {
  items: Achievement[]
  resetKey: string
  renderItem: (item: Achievement, index: number) => ReactNode
  children: ReactNode
}) {
  const viewport = useRef<HTMLDivElement>(null)
  const getItemKey = useCallback((index: number) => items[index].id, [items])
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewport.current,
    getItemKey,
    estimateSize: estimateCardHeight,
    gap: 6,
    paddingStart: 3,
    paddingEnd: 3,
    overscan: 6,
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
          {virtualizer.getVirtualItems().map(({ key, index, start }) => (
            <div
              key={key}
              ref={virtualizer.measureElement}
              data-index={index}
              className="absolute inset-x-0 top-0"
              style={{ transform: `translateY(${start}px)` }}
            >
              {renderItem(items[index], index)}
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </WScrollArea>
  )
}
