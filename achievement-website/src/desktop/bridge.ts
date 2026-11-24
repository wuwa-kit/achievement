import { tr, isLanguage, type AppLanguage } from '../i18n/index.ts'
import { defaultLanguage } from '../i18n/resources'
import { desktopBootstrap } from '../lib/bootstrap'
export type ResourceTier = 'sd' | 'hd' | 'uhd'
export interface DesktopSettings {
  quality?: ResourceTier | 'auto'
  gamePath: string
  language: AppLanguage
  theme?: 'auto' | 'light' | 'dark'
}
export interface HistoryEntry {
  id: string
  uid: string
  exportedAt: string
  completedCount: number
  totalCount: number
  starCount?: number | null
}
export type HistoryExportFormat = 'web' | 'json'
export type CollectionStage =
  'preparing' | 'starting' | 'login' | 'reading' | 'closing' | 'stopping'
export type CollectionNotice = 'gameExited' | 'closeFailed' | 'failed'
export interface CollectionDiagnostic {
  id: string
  code: string
  phase: string
  directory: string | null
  detail: string
  field: string | null
  attempts: number | null
  nativeErrorCode: number | null
}
export interface DesktopState {
  history?: HistoryEntry[]
  stage: CollectionStage | CollectionNotice | 'ready' | 'sending' | 'completed' | 'cancelled'
  busy: boolean
  transferUrl: string | null
  error: string | null
  collectionDiagnostic?: CollectionDiagnostic | null
}
export type UpdateEdition = 'standard' | 'lite'
export interface UpdateAvailability {
  status: 'checked'
  currentVersion: string
  currentEdition: UpdateEdition
  release: {
    version: string
    notes: string
    assets: Record<UpdateEdition, { size: number }>
  } | null
}
export type UpdateCheck =
  | UpdateAvailability
  | { status: 'manifestMissing' | 'networkError' | 'checkTimeout' | 'invalidManifest' }
  | { status: 'httpError'; httpStatus: number }
type UpdateTarget = { edition: UpdateEdition; version: string }
export type UpdateDownload = { attemptId: string; received: number } & (
  | { status: 'downloading' | 'ready' | 'cancelled' }
  | { status: 'failed'; failure: 'integrityFailed' | 'saveFailed' | 'downloadFailed' }
)
export type Methods = {
  'zoom.get': { params: undefined; result: number }
  'zoom.adjust': { params: { direction: 'in' | 'out' | 'reset' }; result: number }
  'update.check': { params: undefined; result: UpdateCheck }
  'update.download': { params: UpdateTarget & { attemptId: string }; result: null }
  'update.cancel': { params: undefined; result: null }
  'update.restart': { params: UpdateTarget; result: null }
  'preferences.save': {
    params: { language: AppLanguage; theme: 'auto' | 'light' | 'dark' }
    result: DesktopSettings
  }
  'theme.set': { params: { dark: boolean }; result: null }
  'history.export': { params: { id: string; format: HistoryExportFormat }; result: null }
  'history.delete': { params: { id: string }; result: DesktopState }
  'settings.get': { params: undefined; result: DesktopSettings }
  'settings.save': { params: DesktopSettings; result: DesktopSettings }
  'game.quality': {
    params: { gamePath: string }
    result: { selected: ResourceTier | null; localTiers: ResourceTier[] } | null
  }
  'game.detect': { params: undefined; result: string | null }
  'game.choose': { params: undefined; result: string | null }
  'export.start': { params: undefined; result: ResourceTier | 'qualityRequired' | null }
  'export.resend': { params: undefined; result: null }
  'export.cancel': { params: undefined; result: null }
  'transfer.copyLink': { params: undefined; result: boolean }
  'browser.open': { params: undefined; result: null }
  'folder.open': { params: undefined; result: null }
  'collection.openDiagnostics': { params: undefined; result: null }
  'collection.copyDiagnostics': { params: undefined; result: null }
  'collection.exportLogs': { params: { gamePath: string }; result: boolean }
  'state.get': { params: undefined; result: DesktopState }
}
export type Message = {
  id?: string
  result?: unknown
  error?: string
} & (
  | { event?: undefined; data?: undefined }
  | { event: 'zoom'; data: number }
  | { event: 'state'; data: DesktopState }
  | { event: 'updateDownload'; data: UpdateDownload }
)
interface WebView {
  postMessage(message: unknown): void
  addEventListener(type: 'message', listener: (event: MessageEvent<Message>) => void): void
}
declare global {
  interface Window {
    chrome?: { webview?: WebView }
  }
}
const webview = window.chrome?.webview
const mockEnabled =
  !import.meta.env.VITE_DESKTOP_BUILD &&
  !webview &&
  new URLSearchParams(window.location.search).get('mock') === '1'
export const isDesktop = !!webview || mockEnabled
const mockHost = mockEnabled
  ? import('./mock-host').then(({ createMockHost }) => createMockHost(receiveMessage))
  : null
let initialSettings: Promise<DesktopSettings> | undefined
export const getInitialDesktopSettings = () =>
  (initialSettings ??=
    desktopBootstrap && isLanguage(desktopBootstrap.language)
      ? Promise.resolve({
          ...desktopBootstrap,
          language: desktopBootstrap.language,
        } as DesktopSettings)
      : request('settings.get'))
const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void }>()
const listeners = new Set<(state: DesktopState) => void>()
const zoomListeners = new Set<(percent: number) => void>()
export function subscribeZoom(listener: (percent: number) => void) {
  zoomListeners.add(listener)
  return () => {
    zoomListeners.delete(listener)
  }
}
const updateListeners = new Set<(state: UpdateDownload) => void>()
function receiveMessage(data: Message) {
  if (data.event === 'zoom') zoomListeners.forEach((listener) => listener(data.data))
  if (data.event === 'state') listeners.forEach((listener) => listener(data.data))
  if (data.event === 'updateDownload') updateListeners.forEach((listener) => listener(data.data))
  if (!data.id) return
  const request = pending.get(data.id)
  if (!request) return
  pending.delete(data.id)
  if (data.error) request.reject(new Error(data.error))
  else request.resolve(data.result)
}
webview?.addEventListener('message', ({ data }) => receiveMessage(data))
export function request<K extends keyof Methods>(
  method: K,
  params?: Methods[K]['params'],
): Promise<Methods[K]['result']> {
  if (mockHost) return mockHost.then((request) => request(method, params))
  if (!webview) {
    try {
      return Promise.resolve(browserRequest(method, params) as Methods[K]['result'])
    } catch (error) {
      return Promise.reject(error)
    }
  }
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID()
    const timeout = window.setTimeout(
      () => {
        pending.delete(id)
        reject(new Error(tr('common.requestTimeout')))
      },
      method === 'history.export' || method === 'collection.exportLogs' ? 3600000 : 30000,
    )
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timeout)
        resolve(value as Methods[K]['result'])
      },
      reject: (error) => {
        clearTimeout(timeout)
        reject(error)
      },
    })
    webview.postMessage({ id, method, params })
  })
}
export function subscribe(listener: (state: DesktopState) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function subscribeUpdateDownload(listener: (state: UpdateDownload) => void) {
  updateListeners.add(listener)
  return () => {
    updateListeners.delete(listener)
  }
}

const previewKey = 'wuwa-desktop-preview-settings'
let previewSettings: DesktopSettings = { gamePath: '', language: defaultLanguage }
function browserRequest(method: keyof Methods, params?: Methods[keyof Methods]['params']) {
  if (method === 'settings.get') {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(previewKey) ?? 'null',
      ) as Partial<DesktopSettings> | null
      if (saved && typeof saved.gamePath === 'string' && isLanguage(saved.language)) {
        previewSettings = {
          quality: saved.quality,
          gamePath: saved.gamePath,
          language: saved.language,
          theme: saved.theme,
        }
      }
    } catch {
      /* Storage is optional for browser preview. */
    }
    return { ...previewSettings }
  }
  if (method === 'settings.save' && params && 'gamePath' in params && 'language' in params) {
    previewSettings = { ...params }
    try {
      sessionStorage.setItem(previewKey, JSON.stringify(previewSettings))
    } catch {
      /* Keep in-memory settings. */
    }
    return { ...previewSettings }
  }
  if (method === 'game.quality') return null
  if (method === 'state.get')
    return {
      stage: 'ready',
      busy: false,
      transferUrl: null,
      error: null,
    } satisfies DesktopState
  throw new Error(tr('common.previewOnly'))
}
