import { tr } from '../i18n/index.ts'
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { acknowledge, parseTicket, receiveExport, type Ticket } from '../lib/handoff'
import {
  archiveKey,
  cachePreview,
  defaultArchiveKey,
  deleteArchive,
  editArchive,
  readArchives,
  readCachedPreview,
  saveArchive,
  selectArchive,
} from '../lib/archives'
import {
  editAchievement,
  exportPayload,
  isFinished,
  parseExport,
  type ExportData,
  type Filters,
} from '../lib/data'
import { wMessage } from './message'

type ViewerFilters = Required<Pick<Filters, 'query' | 'group' | 'hideCompleted' | 'visibility'>>
const initialFilters: ViewerFilters = {
  query: '',
  group: null,
  hideCompleted: false,
  visibility: 'all',
}
// Consume bearer keys before React renders, including StrictMode remounts.
const incomingTicket = parseTicket(location.hash)
const malformedTicket = location.hash.includes('handoff=') && !incomingTicket
if (location.hash.includes('handoff='))
  history.replaceState(history.state, '', location.pathname + location.search)
interface ViewerStore {
  ticket: ReturnType<typeof parseTicket>
  receipt: string | null
  receiving: boolean
  data: ExportData | null
  archives: Awaited<ReturnType<typeof readArchives>>['archives']
  activeKey: string
  pendingImport: (ArchiveImport & { existingTime: string }) | null
  busy: boolean
  filters: ViewerFilters
  hiddenCompletedIds?: ReadonlySet<number>
  revision: number
  update(patch: Partial<ViewerFilters>): void
  refreshArchives(options?: { signal?: AbortSignal; reset?: boolean }): Promise<void>
  saveImport(input: ArchiveImport, approvedTime?: string): Promise<void>
  importFile(file?: File): Promise<void>
  confirmImport(accept: boolean): Promise<void>
  receive(): Promise<void>
  cancelReceive(): void
  finishReceive(ticket: Ticket, receipt: string): Promise<void>
  switchAccount(id: string): Promise<void>
  deleteAccount(key: string): Promise<void>
  setAchievementCompleted(id: number, completed: boolean): Promise<void>
  download(): void
  connect(): () => void
}
type ArchiveImport =
  { data: ExportData; ticket?: never } | { data: ExportData; ticket: Ticket; transferId: string }
let initialLoad: AbortController | undefined
const completionQueue: { id: number; completed: boolean }[] = []
let completionSave: Promise<void> | undefined

function getCompletedIds(data: ExportData | null) {
  return new Set(data?.achievements.filter(isFinished).map((item) => item.id))
}

export const useViewerStore = create<ViewerStore>()(
  immer((set, get) => ({
    ticket: incomingTicket,
    receipt: null,
    receiving: false,
    data: null,
    archives: [],
    activeKey: defaultArchiveKey,
    pendingImport: null,
    busy: true,
    filters: initialFilters,
    revision: 0,
    update: (patch) => {
      const { data } = get()
      set((state) => {
        Object.assign(state.filters, patch)
        // Apply the current completion states only when the user filters the list.
        state.hiddenCompletedIds = state.filters.hideCompleted ? getCompletedIds(data) : undefined
      })
    },
    async refreshArchives({ signal, reset = true } = {}) {
      const current = () => !signal || (!signal.aborted && initialLoad?.signal === signal)
      const { archives, activeKey, data } = await readArchives()
      if (!current()) return
      let next = data
      if (!next) {
        // Keep the archive selection usable even if the static catalog is temporarily unavailable.
        set({ archives, activeKey, data: null })
        const version = import.meta.env.VITE_PREVIEW_VERSION
        next = await readCachedPreview(version)
        if (!current()) return
        if (!next) {
          const response = await fetch(`${import.meta.env.BASE_URL}data/achievements.json`, {
            cache: 'no-store',
            signal,
          })
          if (!response.ok) throw new Error(tr('ui.noExport'))
          next = parseExport(await response.json())
          if (current()) void cachePreview(version, next)
        }
      }
      if (!current()) return
      set((state) => {
        state.archives = archives
        state.activeKey = activeKey
        state.data = next
        if (reset) {
          state.revision++
          state.filters = { ...initialFilters }
          state.hiddenCompletedIds = undefined
        }
      })
    },
    async saveImport(input, approvedTime) {
      if (input.ticket && input.ticket !== get().ticket) return
      const { conflict } = await saveArchive(input.data, approvedTime)
      if (conflict) {
        if (!input.ticket || input.ticket === get().ticket)
          set({ pendingImport: { ...input, existingTime: conflict } })
        return
      }
      set({ pendingImport: null })
      if (input.ticket && input.ticket === get().ticket) set({ receipt: input.transferId })
      await get().refreshArchives()
      wMessage.success(tr('ui.importSuccess'))
      if (input.ticket) await get().finishReceive(input.ticket, input.transferId)
    },
    async importFile(file) {
      if (!file || get().receiving || get().pendingImport || (get().busy && !initialLoad)) return
      const starting = initialLoad
      initialLoad = undefined
      set({ busy: true })
      try {
        if (completionSave) await completionSave
        if (file.size > 32 * 1024 * 1024) throw new Error(tr('ui.fileTooLarge'))
        const imported = parseExport(JSON.parse((await file.text()).replace(/^\uFEFF/, '')))
        await get().saveImport({ data: imported })
      } catch (error) {
        wMessage.error(
          error instanceof SyntaxError
            ? tr('ui.jsonError')
            : error instanceof Error
              ? error.message
              : tr('ui.importError'),
        )
        if (starting && !get().data)
          await get()
            .refreshArchives()
            .catch(() => undefined)
      } finally {
        set({ busy: false })
      }
    },
    async confirmImport(accept) {
      const { pendingImport, busy, receiving } = get()
      if (!pendingImport || busy || receiving) return
      if (!accept) {
        set({ pendingImport: null })
        if (pendingImport.ticket && pendingImport.ticket === get().ticket) get().cancelReceive()
        return
      }
      set({ busy: true })
      try {
        await get().saveImport(pendingImport, pendingImport.existingTime)
      } catch (error) {
        wMessage.error(error instanceof Error ? error.message : tr('ui.importError'))
      } finally {
        set({ busy: false })
      }
    },
    cancelReceive() {
      if (!get().receiving && !get().receipt) set({ ticket: null })
    },
    async finishReceive(ticket, receipt) {
      if (ticket !== get().ticket) return
      try {
        await acknowledge(ticket, receipt)
      } catch {
        // Keep the receipt available for retry after the archive has been saved.
        return
      }
      if (ticket === get().ticket) set({ ticket: null, receipt: null })
    },
    async receive() {
      const { ticket, receiving, receipt, busy, pendingImport } = get()
      if (!ticket || receiving || busy || pendingImport) return
      set({ receiving: true })
      try {
        if (completionSave) await completionSave
        if (receipt) await get().finishReceive(ticket, receipt)
        else await get().saveImport({ ...(await receiveExport(ticket)), ticket })
      } catch (error) {
        if (ticket === get().ticket)
          wMessage.error(
            tr('ui.receiveError', {
              value0: error instanceof Error ? error.message : tr('ui.connectionError'),
            }),
          )
      } finally {
        set({ receiving: false })
      }
    },
    async switchAccount(id) {
      const { activeKey, busy, receiving, pendingImport } = get()
      if (id === activeKey || busy || receiving || pendingImport) return
      set({ busy: true })
      try {
        if (completionSave) await completionSave
        await selectArchive(id)
        await get().refreshArchives()
      } catch {
        wMessage.error(tr('ui.switchError'))
      } finally {
        set({ busy: false })
      }
    },
    async deleteAccount(key) {
      const { data, activeKey, busy, receiving, pendingImport } = get()
      if (!data || key !== activeKey || busy || receiving || pendingImport) return
      set({ busy: true })
      try {
        if (completionSave) await completionSave
        await deleteArchive(activeKey)
        await get().refreshArchives()
        wMessage.success(tr('common.archiveDeleted'))
      } catch (error) {
        wMessage.error(error instanceof Error ? error.message : tr('common.deleteArchiveError'))
      } finally {
        set({ busy: false })
      }
    },
    async setAchievementCompleted(id, completed) {
      const { data, activeKey, busy, receiving, pendingImport } = get()
      if (!data || activeKey !== archiveKey(data.uid) || busy || receiving || pendingImport) return
      const optimistic = editAchievement(data, id, completed)
      if (optimistic === data) return

      completionQueue.push({ id, completed })
      completionSave ??= Promise.resolve().then(() => saveCompletions(data))
      set({ data: optimistic })
      await completionSave

      async function saveCompletions(initial: ExportData) {
        const applyEdits = (initial: ExportData, edits: typeof completionQueue) =>
          edits.reduce(
            (archive, edit) => editAchievement(archive, edit.id, edit.completed),
            initial,
          )
        let committed = initial
        try {
          while (completionQueue.length) {
            const edits = completionQueue.splice(0)
            try {
              const snapshot = await editArchive(activeKey, committed, (stored) =>
                applyEdits(stored, edits),
              )
              if (snapshot.activeKey !== activeKey || !snapshot.data) {
                if (completionQueue.length) wMessage.error(tr('ui.storageSaveError'))
                completionQueue.length = 0
                set({
                  ...snapshot,
                  hiddenCompletedIds: get().filters.hideCompleted
                    ? getCompletedIds(snapshot.data)
                    : undefined,
                })
                return
              }
              committed = snapshot.data
              set({ archives: snapshot.archives, data: applyEdits(committed, completionQueue) })
            } catch (error) {
              set({ data: applyEdits(committed, completionQueue) })
              wMessage.error(error instanceof Error ? error.message : tr('ui.storageSaveError'))
            }
          }
        } finally {
          completionSave = undefined
        }
      }
    },
    download() {
      const { data } = get()
      if (!data) return
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(exportPayload(data), null, 2)], { type: 'application/json' }),
      )
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date(data.capturedAt).toISOString().slice(0, 19)
      link.download = `Wuthering-Waves-Achievements-${data.uid ?? 'unknown'}-${timestamp.replace(/[-:]/g, '').replace('T', '-')}Z.json`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    connect() {
      if (malformedTicket) wMessage.error(tr('ui.invalidTicket'))
      function acceptTicket() {
        if (!location.hash.includes('handoff=')) return
        const ticket = parseTicket(location.hash)
        history.replaceState(history.state, '', location.pathname + location.search)
        if (!ticket) {
          wMessage.error(tr('ui.invalidTicket'))
          return
        }
        const current = get().ticket
        if (current?.key === ticket.key && current.port === ticket.port) return
        set((state) => {
          state.ticket = ticket
          state.receipt = null
          if (state.pendingImport?.ticket) state.pendingImport = null
        })
      }
      window.addEventListener('hashchange', acceptTicket)
      acceptTicket()
      const controller = new AbortController()
      initialLoad = controller
      const { signal } = controller
      set({ busy: true })
      void Promise.resolve(completionSave)
        .then(() => {
          if (!signal.aborted) return get().refreshArchives({ signal })
        })
        .catch((error: unknown) => {
          if (!signal.aborted && initialLoad === controller)
            wMessage.error(error instanceof Error ? error.message : tr('ui.readError'))
        })
        .finally(() => {
          if (!signal.aborted && initialLoad === controller) {
            initialLoad = undefined
            set({ busy: false })
          }
        })
      return () => {
        controller.abort()
        if (initialLoad === controller) initialLoad = undefined
        window.removeEventListener('hashchange', acceptTicket)
      }
    },
  })),
)
