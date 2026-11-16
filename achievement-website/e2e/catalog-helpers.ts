import type { APIResponse } from '@playwright/test'
import { readCatalogPng } from '../src/lib/catalog-png'
import { parseExport, readExport } from '../src/lib/data'

export async function readCatalogResponse(response: APIResponse) {
  return readExport(await readCatalogPng(Uint8Array.from(await response.body()).buffer))
}

export async function readPreviewResponse(response: APIResponse) {
  return parseExport(await readCatalogResponse(response))
}
