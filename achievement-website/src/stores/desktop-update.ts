import { create } from 'zustand'
import {
  isDesktop,
  request,
  subscribeUpdateDownload,
  type UpdateAvailability,
  type UpdateEdition,
} from '../desktop/bridge'
import { tr } from '../i18n'
import { wMessage } from './message'

type AvailableUpdate = UpdateAvailability & { release: NonNullable<UpdateAvailability['release']> }
type DownloadStatus = 'idle' | 'downloading' | 'cancelling' | 'ready' | 'restarting'

interface DesktopUpdateStore {
  offer: AvailableUpdate | null
  edition: UpdateEdition
  open: boolean
  manualChecking: boolean
  status: DownloadStatus
  received: number
  connect(): () => void
  check(manual: boolean): Promise<void>
  selectEdition(edition: UpdateEdition): void
  dismiss(): Promise<void>
  download(): Promise<void>
  restart(): Promise<void>
}

let connected = false
let startupChecked = false
let checkTask: Promise<void> | undefined
let attemptId: string | undefined

export const useDesktopUpdateStore = create<DesktopUpdateStore>((set, get) => ({
  offer: null,
  edition: 'standard',
  open: false,
  manualChecking: false,
  status: 'idle',
  received: 0,
  connect() {
    if (!isDesktop) return () => {}
    connected = true
    const unsubscribe = subscribeUpdateDownload((update) => {
      if (update.attemptId !== attemptId) return
      const { status } = get()
      if (update.status === 'downloading') {
        if (status === 'downloading') set({ received: update.received })
        return
      }

      attemptId = undefined
      if (update.status === 'ready') {
        set({ status: 'ready', received: update.received, open: status !== 'cancelling' })
      } else {
        set({ status: 'idle', received: 0 })
        if (update.status === 'cancelled' || status === 'cancelling') set({ open: false })
        else if (update.status === 'failed') wMessage.error(tr(`desktop.update.${update.failure}`))
      }
    })
    if (!startupChecked) {
      startupChecked = true
      void get().check(false)
    }
    return () => {
      connected = false
      unsubscribe()
    }
  },
  async check(manual) {
    if (manual) set({ manualChecking: true })
    checkTask ??= request('update.check')
      .then((result) => {
        if (!connected) return
        const { offer, manualChecking } = get()
        if (result.status !== 'checked') {
          if (manualChecking) {
            const values = result.status === 'httpError' ? { code: result.httpStatus } : undefined
            wMessage.error(tr(`desktop.update.${result.status}`, values))
          }
          return
        }
        if (!result.release) {
          set({ offer: null, open: false, status: 'idle', received: 0 })
          if (manualChecking) wMessage.info(tr('desktop.update.upToDate'))
          return
        }
        if (offer?.release.version !== result.release.version)
          set({ edition: result.currentEdition, status: 'idle', received: 0 })
        set({ offer: { ...result, release: result.release }, open: true })
      })
      .catch(() => {
        if (connected && get().manualChecking) wMessage.error(tr('desktop.update.checkFailed'))
      })
      .finally(() => {
        checkTask = undefined
        set({ manualChecking: false })
      })
    await checkTask
  },
  selectEdition(edition) {
    const current = get()
    if (edition === current.edition || !['idle', 'ready'].includes(current.status)) return
    set({ edition, status: 'idle', received: 0 })
  },
  async dismiss() {
    const { status } = get()
    if (status === 'cancelling' || status === 'restarting') return
    if (status !== 'downloading') {
      set({ open: false })
      return
    }
    set({ status: 'cancelling' })
    try {
      await request('update.cancel')
    } catch {
      if (get().status !== 'cancelling') return
      set({ status: 'downloading' })
      wMessage.error(tr('desktop.update.cancelFailed'))
    }
  },
  async download() {
    const { offer, edition, status } = get()
    if (!offer || status !== 'idle') return
    const id = crypto.randomUUID()
    attemptId = id
    set({ status: 'downloading', received: 0 })
    try {
      await request('update.download', { edition, version: offer.release.version, attemptId: id })
    } catch {
      if (attemptId !== id) return
      attemptId = undefined
      set({ status: 'idle', received: 0 })
      wMessage.error(tr('desktop.update.downloadFailed'))
    }
  },
  async restart() {
    const { offer, edition, status } = get()
    if (!offer || status !== 'ready') return
    set({ status: 'restarting' })
    try {
      await request('update.restart', { edition, version: offer.release.version })
    } catch {
      set({ status: 'ready' })
      wMessage.error(tr('desktop.update.restartFailed'))
    }
  },
}))
