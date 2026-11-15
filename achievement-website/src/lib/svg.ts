import type { SVGProps } from 'react'
import type { WSvgName } from './svg-names'

// Loaded once, on first WSvg use. Only trusted, bundled SVG files are parsed.
const sources = import.meta.glob<string>('../assets/svg/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const attributeNames: Record<string, string> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
}
export interface SvgAsset {
  element: SVGSVGElement
  attributes: SVGProps<SVGSVGElement>
}
const assets = new Map<WSvgName, SvgAsset>()
for (const [path, source] of Object.entries(sources)) {
  const element = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
  if (element.localName !== 'svg' || element.querySelector('parsererror'))
    throw new Error(`Invalid SVG: ${path}`)
  const attributes = Object.fromEntries(
    Array.from(element.attributes)
      .filter(({ name }) => !['width', 'height', 'class', 'xmlns'].includes(name))
      .map(({ name, value }) => [attributeNames[name] ?? name, value]),
  )
  assets.set(
    path
      .split('/')
      .at(-1)!
      .replace(/\.svg$/, '') as WSvgName,
    { element: element as unknown as SVGSVGElement, attributes },
  )
}
export default assets
