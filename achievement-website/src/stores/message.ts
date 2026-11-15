import { create } from 'zustand'
type MessageType = 'success' | 'error' | 'info'
type Message = { id: number; text: string; type: MessageType; closing: boolean }
export const useMessageStore = create<{ message: Message | null }>(() => ({ message: null }))
let sequence = 0
let timer: ReturnType<typeof setTimeout>
const publish = (message: Message | null) => useMessageStore.setState({ message })
export function dismissMessage() {
  clearTimeout(timer)
  const current = useMessageStore.getState().message
  if (!current) return
  publish({ ...current, closing: true })
  timer = setTimeout(() => publish(null), 180)
}
function show(text: string, type: MessageType, duration = type === 'error' ? 6000 : 4000) {
  if (!text.trim()) return
  clearTimeout(timer)
  publish({ id: ++sequence, text, type, closing: false })
  timer = setTimeout(dismissMessage, duration)
}
export const wMessage = {
  success: (text: string, duration?: number) => show(text, 'success', duration),
  error: (text: string, duration?: number) => show(text, 'error', duration),
  info: (text: string, duration?: number) => show(text, 'info', duration),
  clear: () => {
    clearTimeout(timer)
    publish(null)
  },
}
if (import.meta.hot) import.meta.hot.dispose(() => clearTimeout(timer))
