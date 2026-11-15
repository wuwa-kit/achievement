import { useEventListener } from 'ahooks'
import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import {
  clampSidebarWidth,
  getSidebarViewport,
  getSidebarWidth,
  isSameSidebarViewport,
} from '../lib/sidebar-width'
import { useViewerLayoutStore } from '../stores/viewer-layout'

interface ResizeDrag {
  pointerId: number
  startX: number
  startWidth: number
}

export function ViewerLayout({ children }: { children: ReactNode }) {
  const sidebar = useViewerLayoutStore((state) => state.sidebar)
  const [viewport, setViewport] = useState(getSidebarViewport)
  const [draftWidth, setDraftWidth] = useState<number | null>(null)
  const drag = useRef<ResizeDrag | null>(null)
  const width = draftWidth ?? getSidebarWidth(sidebar, viewport)

  function finishResize() {
    drag.current = null
    setDraftWidth(null)
  }

  function syncViewport() {
    const next = getSidebarViewport()
    if (isSameSidebarViewport(viewport, next)) return true
    finishResize()
    setViewport(next)
    useViewerLayoutStore.getState().resetSidebarWidth()
    return false
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || drag.current) return
    event.preventDefault()
    if (!syncViewport()) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startWidth: width }
    setDraftWidth(width)
  }

  useEventListener('pointermove', (event) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId) return
    if ((event.buttons & 1) === 0) {
      finishResize()
      return
    }
    const width = current.startWidth + event.clientX - current.startX
    setDraftWidth(clampSidebarWidth(width, viewport.viewportWidth))
  })
  useEventListener('pointerup', (event) => {
    const current = drag.current
    if (!current || event.pointerId !== current.pointerId || event.button !== 0) return
    if (!syncViewport()) return
    if (event.clientX !== current.startX) {
      const width = current.startWidth + event.clientX - current.startX
      useViewerLayoutStore.getState().saveSidebarWidth(width, viewport)
    }
    finishResize()
  })
  useEventListener('pointercancel', (event) => {
    if (event.pointerId === drag.current?.pointerId) finishResize()
  })
  useEventListener('blur', finishResize)
  useEventListener('resize', syncViewport)
  useEventListener('focus', syncViewport)

  return (
    <div className="app-shell" style={{ '--sidebar-width': `${width}px` } as CSSProperties}>
      {children}
      {draftWidth !== null && (
        <div className="fixed inset-0 z-30 cursor-ew-resize select-none sidebar-overlay:hidden" />
      )}
      <div
        className="sidebar-resize-handle group fixed inset-y-0 left-(--sidebar-width) z-31 w-2.5 cursor-ew-resize touch-none select-none sidebar-overlay:hidden"
        data-dragging={draftWidth !== null}
        onPointerDown={handlePointerDown}
        onDoubleClick={() => useViewerLayoutStore.getState().resetSidebarWidth()}
        onLostPointerCapture={(event) => {
          if (event.pointerId === drag.current?.pointerId) finishResize()
        }}
      >
        <div className="sidebar-resize-marker pointer-events-none h-full w-1 bg-(--color-gold) opacity-0 group-hover:opacity-[0.68] group-data-[dragging=true]:opacity-100" />
      </div>
    </div>
  )
}
