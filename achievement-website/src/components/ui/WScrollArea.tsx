import { useLayoutEffect, useRef, type ComponentProps } from 'react'
import { OverlayScrollbars, ClickScrollPlugin } from 'overlayscrollbars'
import 'overlayscrollbars/overlayscrollbars.css'
import './WScrollArea.css'

OverlayScrollbars.plugin(ClickScrollPlugin)
export type WScrollAreaProps = ComponentProps<'div'> & { page?: boolean }

function syncScrollbarPosition(instance: OverlayScrollbars) {
  const { scrollOffsetElement, scrollbarHorizontal, scrollbarVertical } = instance.elements()
  const { start, end } = instance.state().scrollCoordinates
  const progress = (offset: number, start: number, end: number) =>
    Math.min(1, Math.max(0, (offset - start) / (end - start) || 0)).toString()

  scrollbarHorizontal.scrollbar.style.setProperty(
    '--os-scroll-percent',
    progress(scrollOffsetElement.scrollLeft, start.x, end.x),
  )
  scrollbarVertical.scrollbar.style.setProperty(
    '--os-scroll-percent',
    progress(scrollOffsetElement.scrollTop, start.y, end.y),
  )
}

/** Keep the existing element as the viewport so React owns its content and layout. */
export function WScrollArea({
  page = false,
  children,
  ref: forwardedRef,
  ...props
}: WScrollAreaProps) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const target = page ? document.body : ref.current
    if (!target) return
    const instance = OverlayScrollbars(
      { target, elements: { viewport: target }, cancel: { body: false } },
      {
        overflow: { x: 'scroll', y: 'scroll' },
        scrollbars: {
          theme: 'w-scrollbar',
          autoHide: 'leave',
          autoHideDelay: 500,
          clickScroll: true,
          dragScroll: true,
        },
      },
      // OverlayScrollbars defers its JavaScript fallback by a frame. Apply the
      // offset in the scroll event so the thumb and content paint together.
      typeof ScrollTimeline === 'undefined' ? { scroll: syncScrollbarPosition } : undefined,
    )
    return () => instance.destroy()
  }, [page])
  if (page) return null
  return (
    <div
      {...props}
      ref={(element) => {
        ref.current = element
        if (typeof forwardedRef === 'function') return forwardedRef(element)
        if (forwardedRef) forwardedRef.current = element
      }}
      data-overlayscrollbars-initialize=""
    >
      {children}
    </div>
  )
}
