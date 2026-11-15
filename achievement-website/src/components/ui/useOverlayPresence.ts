import { useLayoutEffect, useState, type RefObject } from 'react'

export function useOverlayPresence(open: boolean, ref: RefObject<HTMLElement | null>) {
  const [present, setPresent] = useState(open)

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

  return open || present
}
