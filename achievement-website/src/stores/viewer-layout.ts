import { create } from 'zustand'
import {
  clampSidebarWidth,
  filterSidebarWidth,
  getSidebarViewport,
  type SidebarPreference,
  type SidebarViewport,
} from '../lib/sidebar-width'

const sidebarWidthKey = 'wuwa-viewer-sidebar-width'

interface ViewerLayoutStore {
  sidebar: SidebarPreference | null
  saveSidebarWidth(width: number, viewport: SidebarViewport): void
  resetSidebarWidth(): void
}

function readSidebarPreference(): SidebarPreference | null {
  try {
    const sidebar = JSON.parse(
      localStorage.getItem(sidebarWidthKey) ?? 'null',
    ) as SidebarPreference | null
    if (filterSidebarWidth(sidebar, getSidebarViewport()) !== null) return sidebar
    localStorage.removeItem(sidebarWidthKey)
  } catch {
    // Storage may be unavailable or contain an invalid value.
  }
  return null
}

export const useViewerLayoutStore = create<ViewerLayoutStore>((set) => ({
  sidebar: readSidebarPreference(),
  saveSidebarWidth(width, viewport) {
    const sidebar = { ...viewport, width: clampSidebarWidth(width, viewport.viewportWidth) }
    set({ sidebar })
    try {
      localStorage.setItem(sidebarWidthKey, JSON.stringify(sidebar))
    } catch {
      // Keep the width for the current session if storage is unavailable.
    }
  },
  resetSidebarWidth() {
    set({ sidebar: null })
    try {
      localStorage.removeItem(sidebarWidthKey)
    } catch {
      // Storage may be unavailable.
    }
  },
}))
