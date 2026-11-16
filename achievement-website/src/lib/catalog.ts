import { isAccountExport } from './account.ts'
import { cachePreview, readCachedPreview } from './archives.ts'
import { readCatalogPng } from './catalog-png.ts'
import { parseExport, readExport, type ExportData } from './data.ts'
import { isDesktop } from './environment.ts'
import { tr } from '../i18n/index.ts'

let catalog: ExportData | undefined
let pending: Promise<ExportData> | undefined

export function getLoadedCatalog() {
  return catalog
}

export function loadCatalog(): Promise<ExportData> {
  if (catalog) return Promise.resolve(catalog)
  return (pending ??= fetchCatalog().then(
    (data) => {
      catalog = data
      return data
    },
    (error: unknown) => {
      pending = undefined
      throw error
    },
  ))
}

async function fetchCatalog() {
  const version = import.meta.env.VITE_CATALOG_VERSION
  if (!isDesktop) {
    const cached = await readCachedPreview(version)
    if (cached) return cached
  }
  const response = await fetch(import.meta.env.VITE_CATALOG_URL)
  if (!response.ok) throw new Error(tr('ui.noExport'))
  const input = await readCatalogPng(await response.arrayBuffer()).catch((cause: unknown) => {
    throw new Error(tr('ui.noExport'), { cause })
  })
  const data = readExport(input)
  if (!isDesktop) void cachePreview(version, data)
  return data
}

export async function parseAccountOrExport(input: unknown) {
  return parseExport(input, isAccountExport(input) ? await loadCatalog() : undefined)
}
