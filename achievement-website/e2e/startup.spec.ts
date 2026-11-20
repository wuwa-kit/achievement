import { expect, test } from '@playwright/test'
import { selectValue } from './select-helpers'

for (const path of ['/', '/desktop'])
  test(`shows the saved theme and waits for the real toolbar on ${path}`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('wuwa-theme', 'dark'))
    const isRouteModule = (url: URL) =>
      url.pathname === (path === '/' ? '/src/App.tsx' : '/src/desktop/DesktopApp.tsx')
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(isRouteModule, async (route) => {
      await gate
      await route.continue()
    })
    const moduleRequested = page.waitForRequest((request) => isRouteModule(new URL(request.url())))
    try {
      await page.goto(path, { waitUntil: 'commit' })
      await moduleRequested
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(page.getByTestId('theme-switch')).toHaveCount(0)
      await expect(page.locator('.w-language-switch')).toHaveCount(0)
    } finally {
      release()
    }
    const toolbar = page.locator(path === '/' ? '.topbar' : '.desktop-header')
    await expect(toolbar.getByTestId('theme-switch')).toBeEnabled()
    await selectValue(page, toolbar.locator('.w-language-switch'), 'ja')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  })

test('the inline script applies the saved background before the entry module runs', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('wuwa-theme', 'dark'))
  await page.route(
    (url) => url.pathname === '/src/main.tsx',
    (route) => route.abort(),
  )
  await page.goto('/')
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-theme', 'dark')
  await expect(root).toHaveCSS('background-color', 'rgb(17, 21, 33)')
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111521')
})

test('the catalog is read from IndexedDB until its version changes', async ({ page }) => {
  let requests = 0
  await page.route('**/data/achievement-catalog.png', (route) => {
    requests++
    return route.continue()
  })
  await page.goto('/')
  const list = page.getByTestId('成就列表')
  await expect(list).toHaveAttribute('data-count', '1303')
  const firstCard = list.locator('.achievement-card').first()
  await expect(firstCard.locator('.status')).toHaveCount(0)
  await expect(firstCard.locator('.row-progress')).toHaveCount(0)

  // Wait for the best-effort write before reloading with the request blocked.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<{ version: string; format: number; schemaVersion: number } | null>(
            (resolve, reject) => {
              const open = indexedDB.open('wuwa-achievement-archive')
              open.onerror = () => reject(open.error)
              open.onsuccess = () => {
                const db = open.result
                const request = db
                  .transaction('exports')
                  .objectStore('exports')
                  .get('catalog-preview')
                request.onsuccess = () => {
                  const cached = request.result
                  resolve(
                    cached
                      ? {
                          version: cached.version,
                          format: cached.format,
                          schemaVersion: cached.data.schemaVersion,
                        }
                      : null,
                  )
                }
                request.onerror = () => reject(request.error)
                db.close()
              }
            },
          ),
      ),
    )
    .toEqual({ version: expect.stringMatching(/^[a-f0-9]{64}$/), format: 1, schemaVersion: 2 })
  await page.route('**/data/achievement-catalog.png', (route) => {
    requests++
    return route.abort()
  })
  await page.reload()
  await expect(list).toHaveAttribute('data-count', '1303')
  expect(requests).toBe(1)

  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('wuwa-achievement-archive')
        open.onerror = () => reject(open.error)
        open.onsuccess = () => {
          const db = open.result
          const tx = db.transaction('exports', 'readwrite')
          const meta = tx.objectStore('exports')
          const request = meta.get('catalog-preview')
          request.onsuccess = () =>
            meta.put({ ...request.result, version: 'old' }, 'catalog-preview')
          tx.oncomplete = () => resolve()
          tx.onabort = () => reject(tx.error)
          db.close()
        }
      }),
  )
  await page.unroute('**/data/achievement-catalog.png')
  const refreshed = page.waitForResponse('**/data/achievement-catalog.png')
  await page.reload()
  expect((await refreshed).ok()).toBe(true)
  await expect(list).toHaveAttribute('data-count', '1303')
})

test('injected desktop settings render immediately while business state is pending', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('wuwa-language', 'zh-CN')
    localStorage.setItem('wuwa-theme', 'light')
    Object.assign(window, {
      __WUWA_SETTINGS__: {
        language: 'ja',
        theme: 'dark',
        gamePath: 'D:/Game.exe',
      },
    })
    let listener: (event: { data: unknown }) => void
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        webview: {
          addEventListener(_: string, callback: typeof listener) {
            listener = callback
          },
          postMessage(message: { id: string; method: string }) {
            if (message.method === 'settings.get')
              sessionStorage.setItem('settings-requested', 'true')
            if (message.method === 'state.get') return
            queueMicrotask(() => listener({ data: { id: message.id, result: null } }))
          },
        },
      },
    })
  })
  await page.goto('/desktop')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#game-path')).toHaveValue('D:/Game.exe')
  await expect(page.locator('.w-language-switch')).toBeEnabled()
  await expect(page.locator('#game-path')).toBeDisabled()
  await expect(page.locator('.desktop-card')).toHaveCount(0)
  await expect(page.locator('.desktop-history')).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('settings-requested'))).toBeNull()
})
