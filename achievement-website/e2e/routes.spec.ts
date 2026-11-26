import { expect, test } from '@playwright/test'

for (const path of ['/', '/index.html']) {
  test(`viewer consumes the download action before loading ${path}`, async ({ page }) => {
    const isViewerModule = (url: URL) => url.pathname === '/src/App.tsx'
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(isViewerModule, async (route) => {
      await gate
      await route.continue()
    })
    const moduleRequested = page.waitForRequest((request) => isViewerModule(new URL(request.url())))
    try {
      await page.goto(`${path}?source=desktop&download=1#downloads`, { waitUntil: 'commit' })
      await moduleRequested
      await expect(page).toHaveURL(`${path}?source=desktop#downloads`)
      await expect(page.getByTestId('export-tool-download-dialog')).toHaveCount(0)
    } finally {
      release()
    }
    const downloads = page.getByTestId('export-tool-download-dialog')
    await expect(downloads).toBeVisible()
    await expect(downloads.locator('a')).toHaveCount(3)
    await page.getByTestId('close-export-tool-download-dialog').click()
    await expect(downloads).toHaveCount(0)
    await page.goto('/missing')
    await expect(page.getByText('找不到页面')).toBeVisible()
    await page.goBack()
    await expect(page).toHaveURL(`${path}?source=desktop#downloads`)
    await expect(page.getByTestId('export-tool-intro')).toBeVisible()
    await expect(downloads).toHaveCount(0)
  })
}

test('viewer does not load desktop modules', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  await page.goto('/')
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  expect(
    requests.filter(
      (path) => path.startsWith('/src/desktop/') || path === '/src/stores/desktop.ts',
    ),
  ).toEqual([])
})

test('desktop preview does not load viewer data or initialize account storage', async ({
  page,
}) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))
  await page.goto('/desktop?download=1#handoff=v1&port=99999&key=wrong')
  await expect(page.getByTestId('开始采集')).toBeEnabled()
  expect(
    requests.filter(
      (path) =>
        [
          '/src/App.tsx',
          '/src/stores/viewer.ts',
          '/src/stores/export-tool.ts',
          '/src/lib/data.ts',
          '/src/lib/handoff.ts',
          '/data/achievement-catalog.png',
        ].includes(path) || path.includes('achievement-catalog.json'),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name)),
  ).not.toContain('wuwa-achievement-archive')
  expect(new URL(page.url()).hash).toContain('handoff=')
  expect(new URL(page.url()).search).toBe('?download=1')
})

test('404 routes load independently and link back to the viewer', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(new URL(request.url()).pathname))

  for (const path of ['/404', '/missing/page']) {
    await page.goto(path)
    await expect(page.getByText('找不到页面')).toBeVisible()
    await expect(page).toHaveTitle('找不到页面')
  }
  expect(requests).toContain('/src/NotFound.tsx')
  expect(
    requests.filter(
      (path) =>
        path === '/src/App.tsx' ||
        path === '/src/stores/viewer.ts' ||
        path === '/data/achievement-catalog.png' ||
        path.startsWith('/src/desktop/'),
    ),
  ).toEqual([])

  await page.getByText('返回首页').click()
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')
  await page.goBack()
  await expect(page.getByText('找不到页面')).toBeVisible()
})
