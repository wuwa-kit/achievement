export interface SidebarViewport {
  viewportWidth: number
  screenWidth: number
}

export interface SidebarPreference extends SidebarViewport {
  width: number
}

export function getSidebarViewport(): SidebarViewport {
  return { viewportWidth: window.innerWidth, screenWidth: window.screen.width }
}

export function isSameSidebarViewport(a: SidebarViewport, b: SidebarViewport) {
  return a.viewportWidth === b.viewportWidth && a.screenWidth === b.screenWidth
}

export function clampSidebarWidth(width: number, viewportWidth: number) {
  // Leave room for the workspace as well as the navigation labels.
  const maximum = Math.min(420, viewportWidth - 600)
  return Math.max(240, Math.min(width, maximum))
}

export function filterSidebarWidth(sidebar: SidebarPreference | null, viewport: SidebarViewport) {
  if (!sidebar || !Number.isFinite(sidebar.width) || !isSameSidebarViewport(sidebar, viewport))
    return null
  return clampSidebarWidth(sidebar.width, viewport.viewportWidth)
}

export function getSidebarWidth(sidebar: SidebarPreference | null, viewport: SidebarViewport) {
  return (
    filterSidebarWidth(sidebar, viewport) ??
    Math.max(280, Math.min(viewport.viewportWidth * 0.24, 320))
  )
}
