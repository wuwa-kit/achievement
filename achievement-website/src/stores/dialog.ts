import { create } from 'zustand'

export type ConfirmOptions = {
  headingKey: string
  messageKey: string
  values?: Record<string, unknown>
  confirmKey?: string
  cancelKey?: string
  confirmTone?: 'danger'
}
type Request = { options: ConfirmOptions; resolve: (confirmed: boolean) => void }
const queue: Request[] = []
let active: Request | undefined
let answer = false
export const useDialogStore = create<{ options: ConfirmOptions | null; open: boolean }>(() => ({
  options: null,
  open: false,
}))
function next() {
  active = queue.shift()
  answer = false
  useDialogStore.setState({ options: active?.options ?? null, open: !!active })
}
export function answerDialog(confirmed: boolean) {
  if (!useDialogStore.getState().open) return
  answer = confirmed
  useDialogStore.setState({ open: false })
}
export function finishDialog() {
  if (!active || useDialogStore.getState().open) return
  const completed = active
  const confirmed = answer
  next()
  completed.resolve(confirmed)
}
export const wDialog = {
  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      queue.push({ options, resolve })
      if (!active) next()
    })
  },
}
