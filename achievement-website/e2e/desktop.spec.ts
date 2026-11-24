import { selectValue } from './select-helpers'
import { expect, test } from '@playwright/test'

test('desktop route supports browser preview and persists preview language', async ({ page }) => {
  await page.goto('/desktop')
  await expect(page.getByTestId('开始采集')).toBeEnabled()
  await expect(page.locator('#website')).toHaveCount(0)
  await expect(page.locator('.desktop-card > .desktop-export-toggle')).toBeVisible()
  await expect(page.locator('.desktop-header .open-source-link')).toBeVisible()
  await selectValue(page, page.locator('.desktop-language'), 'en')
  await expect(page.getByTestId('Game path')).toBeEditable()
  await page.reload()
  await expect(page.getByTestId('Start capture')).toBeEnabled()
  await page.getByTestId('Start capture').click()
  await expect(page.locator('.w-message[data-type="error"]')).toContainText(
    'requires the desktop client',
  )
})

test('desktop zoom follows host changes and stays open across adjustments', async ({ page }) => {
  await page.setViewportSize({ width: 580, height: 480 })
  await page.addInitScript(() => {
    let receive: (event: { data: unknown }) => void
    let zoom = 110
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        webview: {
          addEventListener: (_: string, callback: typeof receive) => {
            receive = callback
          },
          postMessage: ({
            id,
            method,
            params,
          }: {
            id: string
            method: string
            params?: { direction: string }
          }) => {
            let result: unknown = null
            if (method === 'settings.get') result = { gamePath: '', language: 'zh-CN' }
            if (method === 'state.get') result = { stage: 'ready', busy: false }
            if (method === 'zoom.get') result = zoom
            if (method === 'zoom.adjust') {
              zoom =
                params?.direction === 'reset' ? 100 : zoom + (params?.direction === 'in' ? 25 : -25)
              result = zoom
            }
            queueMicrotask(() => receive({ data: { id, result } }))
          },
        },
      },
    })
    window.addEventListener('test-host-zoom', () => {
      zoom = 150
      receive({ data: { event: 'zoom', data: zoom } })
    })
  })
  await page.goto('/desktop')
  await page.getByTestId('desktop-zoom').click()
  const panel = page.locator('[popover]:popover-open').filter({ has: page.getByTestId('zoom-in') })
  await expect(panel).toContainText('110%')
  await page.evaluate(() => window.dispatchEvent(new Event('test-host-zoom')))
  await expect(panel).toContainText('150%')
  await page.getByTestId('zoom-in').click()
  await expect(panel).toContainText('175%')
  await page.getByTestId('zoom-out').click()
  await expect(panel).toContainText('150%')
  const reset = panel.getByText('150%', { exact: true })
  await reset.hover()
  await expect(page.locator('.w-tooltip')).toHaveText('重置')
  await reset.click()
  await expect(panel).toContainText('100%')
})

test('desktop bridge preserves progress while switching language and supports cancellation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    let listener: (event: { data: unknown }) => void
    let settings = {
      gamePath: 'C:/Game/Wuthering Waves.exe',
      quality: 'auto',
      language: 'zh-CN',
    }
    let state = { stage: 'ready', busy: false, transferUrl: null, error: null }
    window.addEventListener('test-collection-state', (event) => {
      state = { ...state, ...(event as CustomEvent<Partial<typeof state>>).detail }
      listener({ data: { event: 'state', data: state } })
    })
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        webview: {
          addEventListener: (_: string, callback: typeof listener) => {
            listener = callback
          },
          postMessage: (message: { id: string; method: string; params: typeof settings }) => {
            let result: unknown = null
            if (message.method === 'game.quality')
              result = message.params.gamePath.startsWith('D:') ? null : 'hd'
            if (message.method === 'game.detect') result = 'D:/Games/Wuthering Waves.exe'
            if (message.method === 'game.choose') result = 'E:/Game/Wuthering Waves.exe'
            if (message.method === 'settings.get') result = settings
            if (message.method === 'state.get') result = state
            if (message.method === 'settings.save') result = settings = message.params
            if (message.method === 'export.start') {
              if (settings.gamePath.startsWith('D:') && (settings.quality ?? 'auto') === 'auto') result = 'qualityRequired'
              else state = { ...state, stage: 'starting', busy: true }
            }
            if (message.method === 'export.cancel')
              state = { ...state, stage: 'cancelled', busy: false }
            if (message.method === 'collection.exportLogs')
              result = localStorage.getItem('save-logs-result') === 'saved'
            if (message.method.startsWith('collection.'))
              localStorage.setItem('collection-diagnostic-action', message.method)
            queueMicrotask(() => {
              listener({ data: { id: message.id, result } })
              listener({ data: { event: 'state', data: state } })
            })
          },
        },
      },
    })
  })
  await page.goto('/desktop')
  const pathInput = page.getByTestId('游戏路径')
  await expect(pathInput).toHaveAttribute('placeholder', '请选择 Wuthering Waves.exe')
  const logsButton = page.getByTestId('desktop-export-logs')
  await logsButton.click()
  await expect(logsButton).toBeEnabled()
  await expect(page.locator('.w-message')).toHaveCount(0)
  await page.evaluate(() => localStorage.setItem('save-logs-result', 'saved'))
  await logsButton.click()
  await expect(page.locator('.w-message[data-type="success"]')).toHaveText('日志已保存')
  await page.locator('.w-message-close').click()
  await page.mouse.move(0, 0)
  const detect = page.getByTestId('自动检测游戏路径')
  await page.keyboard.press('Tab')
  await detect.focus()
  await expect(page.locator('.w-tooltip')).toHaveText('自动检测游戏路径')
  await detect.press('Escape')
  await expect(page.locator('.w-tooltip')).toHaveCount(0)
  await detect.click()
  await expect(pathInput).toHaveValue('D:/Games/Wuthering Waves.exe')
  const quality = page.getByTestId('resource-quality')
  await expect(quality).toHaveText('自动（未识别）')
  await page.getByTestId('开始采集').click()
  await expect(page.locator('.w-message')).toContainText('无法识别资源档位，请选择已安装的档位')
  await expect(quality).toHaveAttribute('data-expanded', 'true')
  await page.locator('[popover]:popover-open [data-value="sd"]').click()
  await expect(quality).toHaveText('标清')
  await page.getByTestId('开始采集').click()
  await page.locator('.desktop-export-toggle[data-running="true"]').click()
  await selectValue(page, quality, 'auto')
  await page.getByTestId('打开系统文件选择器').click()
  await expect(pathInput).toHaveValue('E:/Game/Wuthering Waves.exe')
  await expect(quality).toHaveText('自动（高清）')
  await selectValue(page, quality, 'uhd')
  await expect(quality).toHaveText('超高清')
  await page.getByTestId('开始采集').click()
  const stage = page.locator('.desktop-stage')
  const body = page.locator('.desktop-description')
  const emitStage = (stage: string, busy: boolean) =>
    page.evaluate(
      (detail) => window.dispatchEvent(new CustomEvent('test-collection-state', { detail })),
      { stage, busy },
    )
  await expect(stage).toHaveText('正在启动鸣潮')
  const spinner = stage.locator('[data-icon="loader-circle"]')
  await expect(spinner).toBeVisible()
  await expect(body).toHaveText('已启动游戏进程，正在等待游戏窗口出现，请稍候')
  await emitStage('login', true)
  await expect(stage).toHaveText('等待登录')
  await expect(page.getByText('请登录并进入游戏，成就同步后会自动开始采集')).toBeVisible()
  await expect(page.getByTestId('停止采集')).toBeEnabled()
  await expect(page.locator('.desktop-export-toggle svg')).toHaveAttribute('data-icon', 'stop')
  await expect(page.getByTestId('游戏路径')).toBeDisabled()
  await expect(logsButton).toBeDisabled()
  await selectValue(page, page.locator('.desktop-language'), 'en')
  await expect(body).toHaveText(
    'Sign in and enter the game. Capture starts automatically once achievements sync',
  )
  await page.getByTestId('Stop capture').click()
  await expect(
    page.getByText('Capture stopped. Exit Wuthering Waves before starting another capture'),
  ).toBeVisible()
  await expect(page.getByTestId('Start capture')).toBeEnabled()
  await expect(spinner).toHaveCount(0)

  await page.locator('.w-message-close').click()
  await expect(page.locator('.w-message')).toHaveCount(0)
  await page.getByTestId('Start capture').click()
  await emitStage('login', true)
  await expect(stage).toHaveText('Waiting for sign-in')
  await emitStage('gameExited', false)
  const notice = page.getByTestId('collection-notice')
  await expect(notice).toContainText('Wuthering Waves has closed')
  await expect(notice).toContainText('Select “Start capture” to try again')
  await expect(notice).toContainText('If the game restarted automatically, exit it first')
  await expect(page.getByTestId('Start capture')).toBeDisabled()
  await notice.getByText('Got it', { exact: true }).click()
  await expect(notice).toHaveCount(0)

  await page.getByTestId('Start capture').click()
  await expect(stage).toHaveText('Starting Wuthering Waves')
  await emitStage('reading', true)
  await expect(stage).toHaveText('Capturing achievements')
  await emitStage('closing', true)
  await expect(stage).toHaveText('Closing Wuthering Waves')
  await expect(body).toContainText('Achievements are saved')
  await expect(page.getByTestId('Stop capture')).toBeDisabled()
  await emitStage('closeFailed', false)
  await expect(notice).toContainText(
    'Achievements are saved. Please close Wuthering Waves manually',
  )
  await expect(page.locator('.w-message')).toHaveCount(0)
  await notice.getByText('Got it', { exact: true }).click()
  await expect(page.getByTestId('Start capture')).toBeEnabled()

  await page.getByTestId('Start capture').click()
  await emitStage('reading', true)
  const failed = {
    stage: 'failed',
    busy: false,
    collectionDiagnostic: {
      id: 'capture-fixture',
      code: 'fieldMissing',
      phase: 'model',
      field: 'AchievementMap',
      attempts: null,
      nativeErrorCode: null,
      directory: 'C:/Game/artifacts/capture-fixture',
      detail: 'Missing Mono field AchievementMap',
    },
  }
  const emitFailure = () =>
    page.evaluate(
      (detail) => window.dispatchEvent(new CustomEvent('test-collection-state', { detail })),
      failed,
    )
  await emitFailure()
  await expect(notice).toContainText('Required field AchievementMap is missing')
  await expect(notice).toContainText('Locating and reading the achievement model')
  await expect(notice).not.toContainText(failed.collectionDiagnostic.directory)
  await page.evaluate(() => localStorage.removeItem('collection-diagnostic-action'))
  await notice.getByText('Export logs', { exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('collection-diagnostic-action')))
    .toBe('collection.exportLogs')
  const beforeClose = await notice.textContent()
  const duringClose = await notice.evaluate(async (dialog) => {
    const result = new Promise<string | null>((resolve) => {
      const observer = new MutationObserver(() => {
        if (dialog.dataset.state !== 'closing') return
        resolve(dialog.textContent)
        observer.disconnect()
      })
      observer.observe(dialog, { attributes: true })
    })
    dialog.querySelectorAll('button').item(dialog.querySelectorAll('button').length - 1).click()
    return result
  })
  expect(duringClose).toBe(beforeClose)
  await emitFailure()
  await expect(notice).toHaveCount(0)
  await expect(page.getByTestId('Start capture')).toBeEnabled()
})

test('desktop history replaces the previous snapshot and confirms deletion', async ({ page }) => {
  const transferUrl = 'http://127.0.0.1:5173/#handoff=v1&port=51234&key=' + 'a'.repeat(64)
  const catalogRequests: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (/achievement-catalog|\/src\/lib\/(catalog|exclusions|data)\.ts/.test(pathname)) {
      catalogRequests.push(pathname)
    }
  })
  await page.addInitScript((transferUrl) => {
    let listener: (event: { data: unknown }) => void
    const history = [
      {
        id: 'old',
        uid: '10001',
        exportedAt: '2026-01-01T00:00:00Z',
        completedCount: 55,
        totalCount: 1307,
        starCount: null as number | null,
      },
    ]
    const state = {
      stage: 'ready',
      busy: false,
      transferUrl: null as string | null,
      error: null,
      history,
    }
    window.addEventListener('test-transfer-received', () => {
      state.stage = 'completed'
      state.busy = false
      state.transferUrl = null
      listener({ data: { event: 'state', data: state } })
    })
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        webview: {
          addEventListener: (_: string, callback: typeof listener) => {
            listener = callback
          },
          postMessage: (message: { id: string; method: string; params: unknown }) => {
            let result: unknown = null
            if (message.method === 'settings.get')
              result = { gamePath: 'game.exe', language: 'zh-CN' }
            if (message.method === 'state.get') result = state
            if (message.method === 'history.read') localStorage.setItem('history-read', 'true')
            if (message.method === 'export.start') {
              state.stage = 'completed'
              history[0] = { ...history[0], id: 'new', completedCount: 56, starCount: 87 }
            }
            if (message.method === 'history.export') {
              localStorage.setItem('last-history-export', JSON.stringify(message.params))
              if ((message.params as { format: string }).format === 'web') {
                state.stage = 'sending'
                state.busy = true
                state.transferUrl = transferUrl
              }
            }
            if (message.method === 'transfer.copyLink') {
              localStorage.setItem('copied-transfer-link', state.transferUrl ?? '')
              result = !!state.transferUrl
            }
            if (message.method === 'export.cancel') {
              state.stage = 'cancelled'
              state.busy = false
              state.transferUrl = null
            }
            if (message.method === 'history.delete') {
              localStorage.setItem('last-history-delete', JSON.stringify(message.params))
              history.splice(0, 1)
              result = state
            }
            queueMicrotask(() => {
              listener({ data: { id: message.id, result } })
              listener({ data: { event: 'state', data: state } })
            })
          },
        },
      },
    })
  }, transferUrl)
  await page.goto('/desktop')
  await expect(page.locator('.desktop-history-card')).toHaveCount(1)
  const card = page.locator('.desktop-history-card').first()
  await expect(card.locator('.desktop-history-count')).toHaveText('55')
  await expect(card.locator('.desktop-history-star-count')).toHaveText('—')
  await page.getByTestId('开始采集').click()
  await expect(page.locator('.desktop-history-card')).toHaveCount(1)
  await expect(card.locator('.desktop-history-count')).toHaveText('56')
  await expect(card.locator('.desktop-history-star-count')).toHaveText('87')
  expect(await page.evaluate(() => localStorage.getItem('history-read'))).toBeNull()
  expect(catalogRequests).toEqual([])
  const exportButton = card.getByTestId('历史记录导出')
  const deleteButton = card.getByTestId('删除档案')
  for (const [label, format] of [
    ['导出到网页', 'web'],
    ['导出成就文件', 'json'],
  ]) {
    await exportButton.click()
    const menu = card.locator('.desktop-history-menu')
    await expect(menu.locator('button')).toHaveCount(2)
    await menu.getByText(label, { exact: true }).click()
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('last-history-export')))
      .toBe(JSON.stringify({ id: 'new', format }))
    await expect(page.locator('.desktop-history-menu')).toHaveCount(0)
    if (format === 'web') {
      const exportCard = page.locator('.desktop-card')
      await expect(exportCard.locator('.desktop-stage')).toHaveText('准备就绪')
      await expect(exportCard.locator('.desktop-stage [data-icon="loader-circle"]')).toHaveCount(0)
      await expect(exportCard.getByTestId('开始采集')).toBeDisabled()
      const dialog = page.getByTestId('transfer-dialog')
      await expect(dialog).toContainText('导出服务正在运行')
      await expect(dialog.getByTestId('transfer-url')).toHaveText(transferUrl)
      await dialog.getByTestId('transfer-copy-link').click()
      await expect
        .poll(() => page.evaluate(() => localStorage.getItem('copied-transfer-link')))
        .toBe(transferUrl)
      await dialog.getByText('停止并关闭', { exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByText('已取消发送', { exact: true })).toBeVisible()
      await expect(exportCard.getByTestId('开始采集')).toBeEnabled()

      await exportButton.click()
      await card.locator('.desktop-history-menu').getByText(label, { exact: true }).click()
      await expect(dialog).toBeVisible()
      await page.evaluate(() => window.dispatchEvent(new Event('test-transfer-received')))
      await expect(dialog).toHaveCount(0)
      await expect(card.locator('.desktop-history-star-count')).toHaveText('87')
      await expect(exportCard.getByTestId('开始采集')).toBeEnabled()
    }
  }
  await deleteButton.click()
  await expect(page.getByTestId('删除档案确认')).toContainText('UID 10001')
  await page.getByTestId('取消删除档案').click()
  await expect(card).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('last-history-delete'))).toBeNull()
  await deleteButton.click()
  await page.getByTestId('确认删除档案').click()
  await expect(card).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('last-history-delete'))).toBe(
    JSON.stringify({ id: 'new' }),
  )
})

test('action messages replace repeats and unmount after dismissal or timeout', async ({ page }) => {
  await page.goto('/desktop')
  await page.getByTestId('开始采集').click()
  await expect(page.locator('.w-message')).toContainText('此操作需要桌面客户端')
  await page.getByTestId('开始采集').click()
  await expect(page.locator('.w-message')).toHaveCount(1)
  await page.locator('.w-message-close').click()
  await expect(page.locator('.w-message-host')).toHaveCount(0)
  await page.getByTestId('开始采集').click()
  await expect(page.locator('.w-message')).toBeVisible()
  await expect(page.locator('.w-message-host')).toHaveCount(0, { timeout: 8000 })
})
