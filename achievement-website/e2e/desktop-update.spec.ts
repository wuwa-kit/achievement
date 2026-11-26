import { expect, test, type Page } from '@playwright/test'
import type { UpdateAvailability, UpdateCheck, UpdateDownload } from '../src/desktop/bridge'

const available: UpdateAvailability = {
  status: 'checked',
  release: {
    version: 'v0.1.3',
    notes: 'Release notes for v0.1.3',
    size: 5_000_000,
  },
}

async function openDesktop(page: Page) {
  await page.addInitScript(() => {
    let listener: (event: { data: unknown }) => void
    Object.defineProperty(window, '__WUWA_SETTINGS__', {
      value: { gamePath: '', language: 'zh-CN', theme: 'auto' },
    })
    window.addEventListener('test-update-message', (event) =>
      listener({ data: (event as CustomEvent).detail }),
    )
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        webview: {
          addEventListener: (_: string, callback: typeof listener) => {
            listener = callback
          },
          postMessage: (message: { id: string; method: string; params?: unknown }) => {
            if (message.method.startsWith('update.')) {
              const key = `test-${message.method}`
              const calls = JSON.parse(sessionStorage.getItem(key) ?? '[]') as unknown[]
              sessionStorage.setItem(key, JSON.stringify([...calls, message]))
              if (message.method === 'update.check') return
            }
            const result =
              message.method === 'state.get'
                ? { stage: 'ready', busy: false, transferUrl: null, error: null }
                : null
            queueMicrotask(() => listener({ data: { id: message.id, result } }))
          },
        },
      },
    })
  })
  await page.goto('/desktop')
}

type Call = { id: string; params?: { version: string; attemptId: string } }
const calls = (page: Page, method: string): Promise<Call[]> =>
  page.evaluate((key) => JSON.parse(sessionStorage.getItem(`test-update.${key}`) ?? '[]'), method)
const emit = (page: Page, message: unknown) =>
  page.evaluate((detail) => {
    window.dispatchEvent(new CustomEvent('test-update-message', { detail }))
  }, message)
const checkButton = (page: Page) => page.getByTestId('desktop-check-update')
const dialog = (page: Page) => page.getByTestId('desktop-update-dialog')

test('startup shows one update, uses the host-selected size, and keeps progress space', async ({
  page,
  context,
}, testInfo) => {
  await context.route('https://wu.songe.li/?download=1', (route) =>
    route.fulfill({ body: 'Download sources' }),
  )
  await openDesktop(page)
  await expect.poll(async () => (await calls(page, 'check')).length).toBe(1)
  await emit(page, { id: (await calls(page, 'check'))[0].id, result: available })
  const update = dialog(page)
  await expect(update).toContainText('发现更新')
  await expect(update).toContainText('Release notes for v0.1.3')
  await expect(update.getByTestId('desktop-update-size')).toHaveText('下载大小：5.0 MB')
  await expect(update).not.toContainText(/当前版本|标准版|Lite/)
  await expect(
    update.locator('[data-testid="desktop-update-lite"], [data-testid="desktop-update-standard"]'),
  ).toHaveCount(0)
  const action = update.getByTestId('desktop-update-action')
  const progress = update.getByTestId('desktop-update-progress')
  const externalDownload = update.getByTestId('desktop-update-external-download')
  await expect(externalDownload).toHaveText('外部下载')
  const [downloads] = await Promise.all([page.waitForEvent('popup'), externalDownload.click()])
  await expect(downloads).toHaveURL('https://wu.songe.li/?download=1')
  await downloads.close()
  await expect(update).toBeVisible()
  expect(await calls(page, 'download')).toHaveLength(0)
  await expect(progress).toBeEmpty()
  const emptyHeight = await progress.evaluate((element) => getComputedStyle(element).height)
  await update.screenshot({ path: testInfo.outputPath('update-available.png') })
  await action.click()
  await expect.poll(async () => (await calls(page, 'download')).length).toBe(1)
  await expect(externalDownload).toHaveCount(0)
  const lite = (await calls(page, 'download'))[0].params!
  expect(lite).toEqual({ version: 'v0.1.3', attemptId: expect.any(String) })

  const sendProgress = (data: UpdateDownload) => emit(page, { event: 'updateDownload', data })
  await sendProgress({ attemptId: lite.attemptId, status: 'downloading', received: 2_500_000 })
  await expect(progress).toContainText('50% · 2.5 / 5.0 MB')
  expect(await progress.evaluate((element) => getComputedStyle(element).height)).toBe(emptyHeight)
  await update.screenshot({ path: testInfo.outputPath('update-downloading.png') })
  await update.getByText('取消', { exact: true }).click()
  await expect.poll(async () => (await calls(page, 'cancel')).length).toBe(1)
  await sendProgress({ attemptId: lite.attemptId, status: 'cancelled', received: 0 })
  await expect(update).toBeHidden()

  await checkButton(page).click()
  await expect.poll(async () => (await calls(page, 'check')).length).toBe(2)
  await emit(page, {
    id: (await calls(page, 'check'))[1].id,
    result: { ...available, release: { ...available.release!, size: 50_000_000 } },
  })
  await expect(externalDownload).toBeVisible()
  await expect(update.getByTestId('desktop-update-size')).toHaveText('下载大小：50.0 MB')
  await action.click()
  await expect.poll(async () => (await calls(page, 'download')).length).toBe(2)
  const standard = (await calls(page, 'download'))[1].params!
  expect(standard).toEqual({ version: 'v0.1.3', attemptId: expect.any(String) })
  await sendProgress({ attemptId: standard.attemptId, status: 'ready', received: 50_000_000 })
  await expect(action).toHaveText('重启')
  await expect(progress).toContainText('下载完成，重启后应用更新')
  await update.screenshot({ path: testInfo.outputPath('update-ready.png') })
  await expect(externalDownload).toHaveCount(0)
  expect(await calls(page, 'restart')).toHaveLength(0)
  await action.click()
  await expect
    .poll(async () => (await calls(page, 'restart'))[0]?.params)
    .toEqual({
      version: 'v0.1.3',
    })
})

test('failed downloads allow retry and restore the external download option', async ({ page }) => {
  await openDesktop(page)
  await expect.poll(async () => (await calls(page, 'check')).length).toBe(1)
  await emit(page, { id: (await calls(page, 'check'))[0].id, result: available })
  await dialog(page).getByTestId('desktop-update-action').click()
  await expect.poll(async () => (await calls(page, 'download')).length).toBe(1)
  await emit(page, {
    event: 'updateDownload',
    data: {
      attemptId: (await calls(page, 'download'))[0].params!.attemptId,
      status: 'failed',
      failure: 'downloadFailed',
      received: 0,
    },
  })
  await expect(dialog(page).getByTestId('desktop-update-external-download')).toBeVisible()
  await expect(dialog(page).getByTestId('desktop-update-action')).toBeEnabled()
  await expect(dialog(page).getByTestId('desktop-update-action')).toHaveText('重试下载')
  await expect(page.locator('.w-message[data-type="error"]')).toHaveText('下载更新失败，请重试')
  await dialog(page).getByTestId('desktop-update-action').click()
  await expect.poll(async () => (await calls(page, 'download')).length).toBe(2)
  const [first, retry] = await calls(page, 'download')
  expect(retry.params!.attemptId).not.toBe(first.params!.attemptId)
  await emit(page, {
    event: 'updateDownload',
    data: { attemptId: first.params!.attemptId, status: 'ready', received: 5_000_000 },
  })
  await expect(dialog(page).getByTestId('desktop-update-action')).toBeDisabled()
  await emit(page, {
    event: 'updateDownload',
    data: { attemptId: retry.params!.attemptId, status: 'ready', received: 5_000_000 },
  })
  await expect(dialog(page).getByTestId('desktop-update-action')).toHaveText('重启')
})

test('manual checks share the startup request and distinguish update check failures', async ({
  page,
}) => {
  await openDesktop(page)
  await expect.poll(async () => (await calls(page, 'check')).length).toBe(1)
  const check = checkButton(page)
  await check.click()
  await expect(check).toBeDisabled()
  const initial = await calls(page, 'check')
  expect(initial).toHaveLength(1)
  await emit(page, { id: initial[0].id, result: { ...available, release: null } })
  await expect(page.locator('.w-message[data-type="info"]')).toContainText('已是最新版本')
  await page.locator('.w-message-close').click()
  await expect(page.locator('.w-message')).toHaveCount(0)
  const failures: [UpdateCheck, string][] = [
    [{ status: 'manifestMissing' }, '未找到更新清单 update.json（HTTP 404）'],
    [{ status: 'networkError' }, '无法连接到更新服务器，请检查网络连接'],
    [{ status: 'checkTimeout' }, '检查更新超时，请稍后重试'],
    [{ status: 'invalidManifest' }, '更新清单无效，暂时无法检查更新'],
    [{ status: 'httpError', httpStatus: 503 }, '更新服务器返回 HTTP 503'],
  ]
  for (const [index, [result, message]] of failures.entries()) {
    await check.click()
    await expect.poll(async () => (await calls(page, 'check')).length).toBe(index + 2)
    await emit(page, { id: (await calls(page, 'check'))[index + 1].id, result })
    await expect(page.locator('.w-message[data-type="error"]')).toHaveText(message)
    await page.locator('.w-message-close').click()
    await expect(page.locator('.w-message')).toHaveCount(0)
  }
  await expect(dialog(page)).toHaveCount(0)
})

const silentResults: UpdateCheck[] = [
  { ...available, release: null },
  { status: 'networkError' },
  { status: 'manifestMissing' },
]
for (const result of silentResults) {
  test(`startup stays silent when update check returns ${result.status}`, async ({ page }) => {
    await openDesktop(page)
    await expect.poll(async () => (await calls(page, 'check')).length).toBe(1)
    await emit(page, { id: (await calls(page, 'check'))[0].id, result })
    await expect(page.getByTestId('开始采集')).toBeEnabled()
    await expect(checkButton(page)).toBeEnabled()
    await expect(page.locator('.w-message')).toHaveCount(0)
    await expect(dialog(page)).toHaveCount(0)
  })
}
