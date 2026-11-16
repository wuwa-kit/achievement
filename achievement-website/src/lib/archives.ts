import { tr } from '../i18n/index.ts'
import { exportPayload, parseExport, readExport, type ExportData } from './data.ts'
import { isAccountExport, parseAccount, type AccountData } from './account.ts'

export const defaultArchiveKey = 'default'
const previewCacheKey = 'catalog-preview'

type Archive = { key: string; uid: string | null; capturedAt: string }
type StoredArchive = Pick<Archive, 'capturedAt'>

export function archiveKey(uid: string | null) {
  return uid ? `uid:${uid}` : defaultArchiveKey
}

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDatabase(): Promise<IDBDatabase> {
  const request = indexedDB.open('wuwa-achievement-archive', 3)
  request.onupgradeneeded = (event) => {
    const db = request.result
    const tx = request.transaction!
    const meta = db.objectStoreNames.contains('exports')
      ? tx.objectStore('exports')
      : db.createObjectStore('exports')
    const accounts = db.objectStoreNames.contains('accounts')
      ? tx.objectStore('accounts')
      : db.createObjectStore('accounts')
    if (!event.oldVersion) return

    const activeRequest = meta.get('active')
    const currentRequest = meta.get('current')
    const keysRequest = accounts.getAllKeys()
    const recordsRequest = accounts.getAll()
    recordsRequest.onsuccess = () => {
      try {
        const migrated = new Map<string, AccountData | ExportData>()
        function collect(raw: unknown) {
          const data = isAccountExport(raw) ? parseAccount(raw) : parseExport(raw)
          const key = archiveKey(data.uid)
          const existing = migrated.get(key)
          if (!existing || Date.parse(data.capturedAt) >= Date.parse(existing.capturedAt))
            migrated.set(key, data)
          return key
        }
        let active = defaultArchiveKey
        recordsRequest.result.forEach((raw, index) => {
          const key = collect(raw)
          if (keysRequest.result[index] === activeRequest.result) active = key
        })
        if (currentRequest.result !== undefined) active = collect(currentRequest.result)
        accounts.clear()
        for (const [key, data] of migrated)
          accounts.put(data.schemaVersion === 3 ? data : exportPayload(data), key)
        meta.delete('current')
        meta.put(active, 'active')
      } catch {
        tx.abort()
      }
    }
  }
  return read(request).then((db) => {
    db.onversionchange = () => db.close()
    return db
  })
}

async function withArchives<T>(
  mode: IDBTransactionMode,
  action: (accounts: IDBObjectStore, meta: IDBObjectStore) => Promise<T>,
) {
  const db = await openDatabase().catch(() => {
    throw new Error(tr('ui.storageOpenError'))
  })
  try {
    const tx = db.transaction(['accounts', 'exports'], mode)
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(new Error(tr('ui.storageSaveError')))
    })
    const [result] = await Promise.all([
      action(tx.objectStore('accounts'), tx.objectStore('exports')).catch((error: unknown) => {
        if (mode === 'readwrite' && !tx.error) tx.abort()
        throw error
      }),
      done,
    ])
    return result
  } finally {
    db.close()
  }
}

async function readArchiveState(accounts: IDBObjectStore, meta: IDBObjectStore) {
  const activeKey = ((await read(meta.get('active'))) as string | undefined) ?? defaultArchiveKey
  const [keys, records] = await Promise.all([
    read(accounts.getAllKeys()) as Promise<string[]>,
    read(accounts.getAll()) as Promise<StoredArchive[]>,
  ])
  const archives: Archive[] = records.map(({ capturedAt }, index) => ({
    key: keys[index],
    uid: keys[index] === defaultArchiveKey ? null : keys[index].slice(4),
    capturedAt,
  }))
  const raw = records[keys.indexOf(activeKey)]
  return {
    archives,
    activeKey: raw === undefined ? defaultArchiveKey : activeKey,
    raw,
  }
}

export function readArchives() {
  return withArchives('readonly', readArchiveState)
}

export async function readCachedPreview(version: string): Promise<ExportData | null> {
  try {
    return await withArchives('readonly', async (_, meta) => {
      const cached = (await read(meta.get(previewCacheKey))) as
        { version: string; data: unknown } | undefined
      return cached?.version === version ? readExport(cached.data) : null
    })
  } catch {
    // The preview is disposable. Fetch a fresh copy if the cache cannot be read.
    return null
  }
}

export async function cachePreview(version: string, data: ExportData): Promise<void> {
  try {
    await withArchives('readwrite', async (_, meta) => {
      await read(meta.put({ version, data }, previewCacheKey))
    })
  } catch {
    // A storage failure must not prevent the downloaded preview from displaying.
  }
}

export function saveArchive(data: ExportData, approvedTime?: string) {
  return withArchives('readwrite', async (accounts, meta) => {
    const key = archiveKey(data.uid)
    const previous = (await read(accounts.get(key))) as StoredArchive | undefined
    if (
      previous &&
      Date.parse(data.capturedAt) < Date.parse(previous.capturedAt) &&
      approvedTime !== previous.capturedAt
    )
      return { conflict: previous.capturedAt } as const

    accounts.put(exportPayload(data), key)
    meta.put(key, 'active')
    return { conflict: null } as const
  })
}

export function selectArchive(key: string) {
  return withArchives('readwrite', async (accounts, meta) => {
    if (key !== defaultArchiveKey && (await read(accounts.getKey(key))) === undefined)
      throw new Error(tr('ui.archiveSwitchError'))
    meta.put(key, 'active')
  })
}

export function deleteArchive(key: string) {
  return withArchives('readwrite', async (accounts, meta) => {
    if (key !== defaultArchiveKey && !key.startsWith('uid:'))
      throw new Error(tr('common.deleteArchiveError'))
    accounts.delete(key)
    meta.put(defaultArchiveKey, 'active')
  })
}

export function editArchive(
  key: string,
  initial: ExportData,
  edit: (data: ExportData) => ExportData,
  catalog?: ExportData,
) {
  return withArchives('readwrite', async (accounts, meta) => {
    const raw = await read(accounts.get(key))
    if (raw === undefined && key !== defaultArchiveKey) throw new Error(tr('ui.archiveSwitchError'))
    const data = edit(raw === undefined ? initial : parseExport(raw, catalog))
    accounts.put(exportPayload(data), key)
    return readArchiveState(accounts, meta)
  })
}
