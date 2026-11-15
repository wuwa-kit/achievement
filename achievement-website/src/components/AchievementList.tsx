import { Fragment, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Achievement } from '../lib/data'
import { WScrollArea } from './ui/WScrollArea'

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

  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0
  }, [resetKey])

  return (
    <WScrollArea
      ref={viewport}
      className="achievement-list min-h-0 flex-1 overflow-auto overscroll-contain"
      data-testid="成就列表"
      data-count={items.length}
    >
      {items.length ? (
        <div className="achievement-list-content flex flex-col gap-[6px] py-[3px]">
          {items.map((item, index) => (
            <Fragment key={item.id}>{renderItem(item, index)}</Fragment>
          ))}
        </div>
      ) : (
        children
      )}
    </WScrollArea>
  )
}
