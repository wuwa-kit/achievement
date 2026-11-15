import {
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
} from 'react'
import type { WSvgName } from '../../lib/svg-names'
import type { SvgAsset } from '../../lib/svg'

export type WSvgProps = Omit<ComponentProps<'svg'>, 'name' | 'children'> & {
  name: WSvgName
  size?: number | string
}
let registry: Map<WSvgName, SvgAsset> | undefined
let loading: Promise<Map<WSvgName, SvgAsset>> | undefined
const load = () =>
  (loading ??= import('../../lib/svg').then((module) => (registry = module.default)))

export function WSvg({ name, size = 24, className = '', ref: forwardedRef, ...props }: WSvgProps) {
  const instanceId = useId()
  const elementRef = useRef<SVGSVGElement>(null)
  useImperativeHandle(forwardedRef, () => elementRef.current!, [])
  const [assets, setAssets] = useState(registry)
  useEffect(() => {
    if (registry) {
      setAssets(registry)
      return
    }
    let active = true
    void load()
      .then((value) => {
        if (active) setAssets(value)
      })
      .catch((error) => console.error('Unable to load SVG assets', error))
    return () => {
      active = false
    }
  }, [])
  const asset = assets?.get(name)
  useLayoutEffect(() => {
    // Prepare every new node first, then replace in one operation before paint.
    // Do not clear in an effect cleanup: that would blank the previous icon on switches.
    const clone = asset?.element.cloneNode(true) as SVGSVGElement | undefined
    if (clone?.querySelector('[id]')) {
      const ids = new Map<string, string>()
      for (const element of clone.querySelectorAll('[id]')) {
        const id = element.id
        element.id = `${instanceId}-${id}`
        ids.set(id, element.id)
      }
      for (const element of clone.querySelectorAll('*')) {
        for (const attribute of element.attributes) {
          const reference = attribute.value.match(/^url\(#([^)]*)\)$/)
          const id = reference && ids.get(reference[1])
          if (id) attribute.value = `url(#${id})`
        }
      }
    }
    elementRef.current?.replaceChildren(...(clone?.childNodes ?? []))
  }, [asset, instanceId])
  return (
    <svg
      {...asset?.attributes}
      viewBox={asset?.attributes.viewBox ?? '0 0 1 1'}

      {...props}
      ref={elementRef}
      width={size}
      height={size}
      data-icon={name}
      className={`w-svg inline-block shrink-0 align-middle ${className}`}
    />
  )
}
