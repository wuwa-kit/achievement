import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

export function useOverlayPresence(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  children: ReactNode,
) {
  const [present, setPresent] = useState(open)

  const lastContent = useRef<ReactNode>(null)
  useLayoutEffect(() => {
    if (open) lastContent.current = children
    else if (!present) lastContent.current = null
  }, [open, children, present])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    if (open) {
      setPresent(true)
      return
    }

    let cancelled = false
    const frame = requestAnimationFrame(() => {
      // Include the backdrop and discrete transitions, but ignore animations inside the overlay.
      const animations = element
        .getAnimations({ subtree: true })
        .filter(({ effect }) => effect instanceof KeyframeEffect && effect.target === element)
      void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
        if (!cancelled) setPresent(false)
      })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [open, ref])

  return { present: open || present, content: open ? children : lastContent.current }
}
