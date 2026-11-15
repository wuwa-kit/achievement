export interface DesktopBootstrap {
  gamePath: string
  language: string
  theme: string
}
declare global {
  interface Window {
    __WUWA_SETTINGS__?: DesktopBootstrap
  }
}
// This module must remain independent of the bridge and page stores.
export const desktopBootstrap =
  typeof window !== 'undefined' && window.chrome?.webview ? window.__WUWA_SETTINGS__ : undefined
