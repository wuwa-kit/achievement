import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Achievement } from '../lib/data'
import { WScrollArea } from './ui/WScrollArea'

const rowHeight = 86

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
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const focusedIndex = focusedId === null ? -1 : items.findIndex((item) => item.id === focusedId)
  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: items.length,
    getScrollElement: () => viewport.current,
    // Any visual gap fits within this fixed slot height.
    estimateSize: () => rowHeight,
    getItemKey: useCallback((index: number) => items[index].id, [items]),
    rangeExtractor: useCallback(
      (range: Range) => {
        const indexes = defaultRangeExtractor(range)
        if (focusedIndex >= 0 && !indexes.includes(focusedIndex)) indexes.push(focusedIndex)
        return indexes.sort((a, b) => a - b)
      },
      [focusedIndex],
    ),
    overscan: 5,
  })

  useLayoutEffect(() => {
    virtualizer.scrollToOffset(0)
  }, [resetKey, virtualizer])

  return (
    <WScrollArea
      ref={viewport}
      className="achievement-list min-h-0 flex-1 overflow-auto overscroll-contain [overflow-anchor:none]"
      data-testid="成就列表"
      data-count={items.length}
    >
      {items.length ? (
        <div
          className="achievement-list-content relative overflow-clip"
          style={{ height: items.length * rowHeight }}
        >
          {virtualizer.getVirtualItems().map((row) => (
            <div
              className="achievement-list-item absolute inset-x-0"
              key={row.key}
              data-index={row.index}
              style={{ top: row.start, height: rowHeight }}
              onFocus={() => setFocusedId(items[row.index].id)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setFocusedId(null)
              }}
            >
              {renderItem(items[row.index], row.index)}
            </div>
          ))}
        </div>
      ) : (
        children
      )}
    </WScrollArea>
  )
}
