import { useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import { WTooltip, type WTooltipProps } from './WTooltip'

export type WEllipsisProps = {
  children: string
  ref?: Ref<HTMLSpanElement>
  className?: string
  placement?: WTooltipProps['placement']
}

export function WEllipsis({ children, ref: outerRef, className = '', placement }: WEllipsisProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)
  useImperativeHandle(outerRef, () => ref.current!, [])

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    let disposed = false
    const measure = () => {
      if (!disposed)
        setTruncated(element.clientWidth > 0 && element.scrollWidth > element.clientWidth)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    void document.fonts.ready.then(measure)
    document.fonts.addEventListener('loadingdone', measure)
    document.fonts.addEventListener('loadingerror', measure)
    return () => {
      disposed = true
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', measure)
      document.fonts.removeEventListener('loadingerror', measure)
    }
  }, [children])

  return (
    <WTooltip text={truncated ? children : ''} placement={placement}>
      <span
        ref={ref}
        className={`w-ellipsis block max-w-full min-w-0 truncate ${className}`}
        data-truncated={truncated}
      >
        {children}
      </span>
    </WTooltip>
  )
}
