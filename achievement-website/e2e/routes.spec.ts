import { expect, test } from '@playwright/test'

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
  await page.goto('/desktop#handoff=v1&port=99999&key=wrong')
  await expect(page.getByTestId('开始采集')).toBeEnabled()
  expect(
    requests.filter(
      (path) =>
        [
          '/src/App.tsx',
          '/src/stores/viewer.ts',
          '/src/lib/data.ts',
          '/src/lib/handoff.ts',
          '/data/achievements.json',
        ].includes(path) || path.includes('achievement-catalog.json'),
    ),
  ).toEqual([])
  expect(
    await page.evaluate(async () => (await indexedDB.databases()).map((db) => db.name)),
  ).not.toContain('wuwa-achievement-archive')
  expect(new URL(page.url()).hash).toContain('handoff=')
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
        path === '/data/achievements.json' ||
        path.startsWith('/src/desktop/'),
    ),
  ).toEqual([])

  await page.getByText('返回首页').click()
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/')
  await page.goBack()
  await expect(page.getByText('找不到页面')).toBeVisible()
})
