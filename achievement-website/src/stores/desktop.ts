import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  request,
  subscribe,
  getInitialDesktopSettings,
  type CollectionNotice,
  type DesktopSettings,
  type DesktopState,
  type HistoryExportFormat,
} from '../desktop/bridge'
import { tr } from '../i18n/index.ts'
import { desktopBootstrap } from '../lib/bootstrap'
import { usePreferencesStore } from './preferences'
import { wMessage } from './message'
import type { summarize } from '../lib/data'

export type HistorySummary = Pick<
  ReturnType<typeof summarize>,
  'total' | 'completedAstrite' | 'astrite'
>

interface DesktopStore {
  settings: DesktopSettings
  state: DesktopState
  historySummaries: Partial<Record<string, HistorySummary | null>>
  loaded: boolean
  pending: boolean
  notice: CollectionNotice | null
  connect(): () => void
  acceptState(state: DesktopState): void
  dismissNotice(): void
  openCollectionDiagnostics(): Promise<void>
  copyCollectionDiagnostics(): Promise<void>
  exportLogs(): Promise<void>
  setGamePath(path: string): void
  detectPath(): Promise<void>
  choosePath(): Promise<void>
  startExport(): Promise<void>
  cancelExport(): Promise<void>
  copyTransferLink(): Promise<void>
  exportHistory(id: string, format: HistoryExportFormat): Promise<void>
  deleteHistory(id: string): Promise<void>
  act(action: () => Promise<unknown>): Promise<void>
}
export const useDesktopStore = create<DesktopStore>()(
  immer((set, get) => ({
    settings: {
      gamePath: desktopBootstrap?.gamePath ?? '',
      language: usePreferencesStore.getState().language,
    },
    state: { stage: 'ready', busy: false, transferUrl: null, error: null },
    historySummaries: {},
    loaded: false,
    pending: false,
    notice: null,
    acceptState(state) {
      const { state: previous, historySummaries } = get()
      const history = state.history ?? []
      set({
        state: structuredClone(state),
        historySummaries: Object.fromEntries(
          history.map(({ id }) => [id, historySummaries[id] ?? null]),
        ),
      })
      for (const { id } of history) {
        if (Object.hasOwn(historySummaries, id)) continue
        void Promise.all([
          request('history.read', { id }),
          import('../lib/data'),
          import('../lib/catalog'),
        ])
          .then(async ([snapshot, { summarize }, { parseAccountOrExport }]) => {
            const { total, completedAstrite, astrite } = summarize(
              (await parseAccountOrExport(snapshot)).achievements,
            )
            set((store) => {
              if (Object.hasOwn(store.historySummaries, id))
                store.historySummaries[id] = { total, completedAstrite, astrite }
            })
          })
          .catch((error) => {
            if (Object.hasOwn(get().historySummaries, id)) wMessage.error(String(error))
          })
      }
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
          const key = previous.stage === 'sending' ? 'desktop.sendCancelled' : 'desktop.cancelled'
          wMessage.info(tr(key))
        }
      }
    },
    dismissNotice: () => set({ notice: null }),
    openCollectionDiagnostics: () => get().act(() => request('collection.openDiagnostics')),
    copyCollectionDiagnostics: () =>
      get().act(async () => {
        await request('collection.copyDiagnostics')
        wMessage.success(tr('desktop.captureDiagnostics.copied'))
      }),
    exportLogs: () =>
      get().act(async () => {
        if (get().state.busy) return
        if (await request('collection.exportLogs', { gamePath: get().settings.gamePath }))
          wMessage.success(tr('desktop.logsSaved'))
      }),
    connect() {
      let active = true
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
    setGamePath: (path) =>
      set((state) => {
        state.settings.gamePath = path
      }),
    detectPath: () =>
      get().act(async () => {
        const path = await request('game.detect')
        if (!path) throw new Error(tr('desktop.notFound'))
        get().setGamePath(path)
      }),
    choosePath: () =>
      get().act(async () => {
        const path = await request('game.choose')
        if (path) get().setGamePath(path)
      }),
    startExport: () =>
      get().act(async () => {
        if (get().state.busy || get().notice) return
        await request('settings.save', get().settings)
        await request('export.start')
      }),
    cancelExport: () =>
      get().act(async () => {
        if (get().state.busy) await request('export.cancel')
      }),
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
