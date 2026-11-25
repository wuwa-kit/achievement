import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  request,
  subscribe,
  subscribeZoom,
  isDesktop,
  getInitialDesktopSettings,
  type SdkStatus,
  type CollectionNotice,
  type DesktopSettings,
  type ResourceTier,
  type DesktopState,
  type HistoryExportFormat,
} from '../desktop/bridge'
import { tr } from '../i18n/index.ts'
import { desktopBootstrap } from '../lib/bootstrap'
import { usePreferencesStore } from './preferences'
import { wMessage } from './message'
import { wDialog } from './dialog'

interface DesktopStore {
  sdk: SdkStatus | null
  sdkChecking: boolean
  sdkCheckFailed: boolean
  sdkPreparing: boolean
  sdkDialogOpen: boolean
  sdkResume: boolean
  sdkContinued: boolean
  gameDetected: boolean
  refreshSdk(): Promise<void>
  openSdkDialog(): void
  closeSdkDialog(): void
  prepareSdk(): Promise<void>
  zoom: number
  adjustZoom(direction: 'in' | 'out' | 'reset'): Promise<void>
  settings: DesktopSettings
  state: DesktopState
  loaded: boolean
  pending: boolean
  notice: CollectionNotice | null
  connect(): () => void
  acceptState(state: DesktopState): void
  dismissNotice(): void
  exportLogs(): Promise<void>
  detectedQuality: ResourceTier | null | undefined
  wegame: boolean
  localTiers: ResourceTier[]
  refreshQuality(): Promise<void>
  setQuality(value: ResourceTier | 'auto'): Promise<void>
  setGamePath(path: string): void
  detectPath(): Promise<void>
  choosePath(): Promise<void>
  startExport(sdkPrepared?: boolean): Promise<boolean>
  cancelExport(): Promise<void>
  copyTransferLink(): Promise<void>
  exportHistory(id: string, format: HistoryExportFormat): Promise<void>
  deleteHistory(id: string): Promise<void>
  act(action: () => Promise<unknown>): Promise<void>
}
export const useDesktopStore = create<DesktopStore>()(
  immer((set, get) => ({
    sdk: null,
    sdkChecking: false,
    sdkCheckFailed: false,
    sdkPreparing: false,
    sdkDialogOpen: false,
    sdkResume: false,
    sdkContinued: false,
    gameDetected: false,
    async refreshSdk() {
      const gamePath = get().settings.gamePath
      if (!get().wegame || get().sdkPreparing) return
      set({ sdkChecking: true, sdkCheckFailed: false })
      try {
        const sdk = await request('sdk.check', { gamePath })
        if (get().settings.gamePath === gamePath) set({ sdk, sdkCheckFailed: false })
      } catch {
        if (get().settings.gamePath === gamePath) set({ sdkCheckFailed: true })
      } finally {
        if (get().settings.gamePath === gamePath) set({ sdkChecking: false })
      }
    },
    openSdkDialog: () =>
      set({ sdkDialogOpen: true, sdkResume: get().sdkPreparing && get().sdkResume }),
    closeSdkDialog: () => set({ sdkDialogOpen: false }),
    async prepareSdk() {
      let resume = false
      await get().act(async () => {
        if (get().state.busy) return
        set({
          sdkPreparing: true,
          sdkCheckFailed: false,
          sdkContinued: false,
          sdk: {
            status: get().sdk?.total ? 'downloading' : 'preparing',
            received: 0,
            total: get().sdk?.total ?? 0,
          },
        })
        try {
          const ready = await request('sdk.prepare', { gamePath: get().settings.gamePath })
          if (ready) {
            resume = get().sdkResume
            set({
              sdk: { status: 'ready', received: 0, total: 0 },
              sdkResume: false,
            })
          } else {
            set({
              sdk: {
                status:
                  get().state.stage === 'cancelled'
                    ? (get().state.sdkStatus?.status ?? 'missing')
                    : 'failed',
                received: 0,
                total: get().state.sdkStatus?.total ?? 0,
              },
            })
          }
        } catch (error) {
          set({ sdk: { status: 'failed', received: 0, total: get().sdk?.total ?? 0 } })
          throw error
        } finally {
          set({ sdkPreparing: false })
        }
      })
      if (resume) {
        await get().startExport(true)
        set({ sdkContinued: get().state.busy })
      }
    },
    zoom: 100,
    async adjustZoom(direction) {
      try {
        set({ zoom: await request('zoom.adjust', { direction }) })
      } catch (error) {
        wMessage.error(String(error))
      }
    },
    settings: {
      gamePath: desktopBootstrap?.gamePath ?? '',
      language: usePreferencesStore.getState().language,
    },
    state: { stage: 'ready', busy: false, transferUrl: null, error: null },
    loaded: false,
    pending: false,
    notice: null,
    acceptState(state) {
      const previous = get().state
      set({
        state: structuredClone(state),
        ...(get().sdkPreparing && state.busy && state.sdkStatus && get().sdk?.status !== 'stopping'
          ? { sdk: state.sdkStatus }
          : {}),
      })
      if (state.error && state.error !== previous.error) wMessage.error(state.error)
      const diagnostic = state.collectionDiagnostic
      if (
        diagnostic &&
        diagnostic.id !== previous.collectionDiagnostic?.id &&
        state.stage === 'failed'
      )
        set({ notice: 'failed' })
      if (previous.stage !== state.stage) {
        if (state.stage === 'gameExited' || state.stage === 'closeFailed')
          set({ notice: state.stage })
        if (state.stage === 'completed') {
          const key = previous.stage === 'sending' ? 'desktop.completed' : 'desktop.captured'
          wMessage.success(tr(key))
        }
        if (state.stage === 'cancelled') {
          const key = get().sdkPreparing
            ? 'desktop.sdk.cancelled'
            : previous.stage === 'sending'
              ? 'desktop.sendCancelled'
              : 'desktop.cancelled'
          wMessage.info(tr(key))
        }
      }
    },
    dismissNotice: () => set({ notice: null }),
    exportLogs: () =>
      get().act(async () => {
        if (get().state.busy) return
        if (await request('collection.exportLogs', { gamePath: get().settings.gamePath }))
          wMessage.success(tr('desktop.logsSaved'))
      }),
    connect() {
      let active = true
      let receivedZoom = false
      const unsubscribeZoom = subscribeZoom((zoom) => {
        receivedZoom = true
        set({ zoom })
      })
      if (isDesktop)
        void request('zoom.get')
          .then((zoom) => {
            if (active && !receivedZoom && zoom > 0) set({ zoom })
          })
          .catch((error) => {
            if (active) wMessage.error(String(error))
          })
      let receivedState = false
      const unsubscribePreferences = usePreferencesStore.subscribe(({ language, mode }) => {
        set((state) => {
          state.settings.language = language
          state.settings.theme = mode
        })
      })
      const unsubscribe = subscribe((state) => {
        receivedState = true
        get().acceptState(state)
      })
      void Promise.all([getInitialDesktopSettings(), request('state.get')])
        .then(([settings, state]) => {
          if (!active) return
          set({
            settings: {
              ...settings,
              language: usePreferencesStore.getState().language,
              theme: usePreferencesStore.getState().mode,
            },
            loaded: true,
          })
          if (!receivedState) get().acceptState(state)
        })
        .catch((error) => {
          if (active) wMessage.error(String(error))
        })
      return () => {
        active = false
        unsubscribe()
        unsubscribePreferences()
        unsubscribeZoom()
      }
    },
    async act(action) {
      if (get().pending) return
      set({ pending: true })
      try {
        await action()
      } catch (error) {
        wMessage.error(error instanceof Error ? error.message : String(error))
      } finally {
        set({ pending: false })
      }
    },
    detectedQuality: undefined,
    wegame: false,
    localTiers: [],
    async refreshQuality() {
      const gamePath = get().settings.gamePath
      if (!gamePath.trim()) return
      const detection = await request('game.quality', { gamePath }).catch(() => null)
      if (get().settings.gamePath === gamePath)
        set({
          detectedQuality: detection?.selected ?? null,
          localTiers: detection?.localTiers ?? [],
          wegame: detection?.wegame ?? false,
          gameDetected: detection !== null,
        })
    },
    setQuality: (quality) =>
      get().act(async () => {
        if (get().state.busy || (get().settings.quality ?? 'auto') === quality) return
        if (quality !== 'auto') {
          await get().refreshQuality()
          if (
            !get().localTiers.includes(quality) &&
            !(await wDialog.confirm({
              headingKey: 'desktop.quality.unavailableTitle',
              messageKey: 'desktop.quality.unavailableBody',
              confirmKey: 'desktop.quality.continueSwitch',
            }))
          )
            return
        }
        set((state) => {
          state.settings.quality = quality
        })
      }),
    setGamePath: (path) =>
      set((state) => {
        if (state.settings.gamePath === path) return
        state.sdk = null
        state.sdkChecking = false
        state.sdkCheckFailed = false
        state.sdkResume = false
        state.sdkContinued = false
        state.gameDetected = false
        state.wegame = false
        state.localTiers = []
        state.detectedQuality = undefined
        state.settings.gamePath = path
      }),
    detectPath: () =>
      get().act(async () => {
        const path = await request('game.detect')
        if (!path) throw new Error(tr('desktop.notFound'))
        get().setGamePath(path)
        await get().refreshQuality()
      }),
    choosePath: () =>
      get().act(async () => {
        const path = await request('game.choose')
        if (path) {
          get().setGamePath(path)
          await get().refreshQuality()
        }
      }),
    async startExport(sdkPrepared = false) {
      let needsQuality = false
      await get().act(async () => {
        if (get().state.busy || get().notice) return
        await get().refreshQuality()
        if (get().wegame && !sdkPrepared) {
          await get().refreshSdk()
          if (get().sdkCheckFailed || get().sdk?.status !== 'ready') {
            set({ sdkDialogOpen: true, sdkResume: true })
            return
          }
        }
        await request('settings.save', get().settings)
        const result = await request('export.start')
        if (result === 'qualityRequired') {
          needsQuality = true
          set({ detectedQuality: null, localTiers: [] })
          wMessage.info(tr('desktop.quality.choose'))
        } else if (result) set({ detectedQuality: result })
      })
      return needsQuality
    },
    async cancelExport() {
      if (get().sdkPreparing) {
        const previous = get().sdk
        set({ sdk: { status: 'stopping', received: 0, total: 0 } })
        try {
          await request('export.cancel')
        } catch (error) {
          set({ sdk: previous })
          wMessage.error(String(error))
        }
        return
      }
      await get().act(async () => {
        if (get().state.busy) await request('export.cancel')
      })
    },
    copyTransferLink: () =>
      get().act(async () => {
        if (get().state.transferUrl && (await request('transfer.copyLink')))
          wMessage.success(tr('desktop.transfer.linkCopied'))
      }),
    exportHistory: (id, format) => get().act(() => request('history.export', { id, format })),
    deleteHistory: (id) =>
      get().act(async () => {
        if (get().state.busy || !get().state.history?.some((entry) => entry.id === id)) return
        get().acceptState(await request('history.delete', { id }))
        wMessage.success(tr('common.archiveDeleted'))
      }),
  })),
)
