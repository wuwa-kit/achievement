import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { catalogPng } from '../build/catalog-png'
import { localFixture } from '../test/local-fixtures'
import { skipIfMissingLocalFixtures } from './local-fixtures'

const fixtureName = 'achievements.json'
const fixture = localFixture(fixtureName)
skipIfMissingLocalFixtures(fixtureName)

test.beforeEach(async ({ page }) => {
  await page.route('**/data/achievement-catalog.png', async (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: catalogPng((await readFile(fixture, 'utf8')).replace(/^\uFEFF/, '')),
    }),
  )
})

test('desktop sidebar resizes within the workspace limits and restores only at the same size', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Requires the docked sidebar')
  await page.goto('/')
  const sidebar = page.locator('.sidebar')
  const workspace = page.locator('.workspace')
  const handle = page.locator('.sidebar-resize-handle')
  const marker = handle.locator('.sidebar-resize-marker')
  await expect(sidebar).toHaveCSS('width', '320px')
  await expect(handle).toHaveCSS('cursor', 'ew-resize')
  await expect(marker).toHaveCSS('opacity', '0')

  await page.mouse.move(325, 1)
  await expect(marker).toHaveCSS('opacity', '0.68')
  await page.mouse.move(325, 1049)
  await expect(marker).toHaveCSS('opacity', '0.68')
  await expect(marker).toHaveCSS('height', '1050px')
  await page.mouse.down()
  await expect(marker).toHaveCSS('opacity', '1')
  await expect(marker).toHaveCSS('height', '1050px')
  await page.mouse.move(385, 100)
  await expect(sidebar).toHaveCSS('width', '380px')
  await expect(workspace).toHaveCSS('margin-left', '380px')
  await page.mouse.move(20, 100)
  await expect(sidebar).toHaveCSS('width', '240px')
  await page.mouse.move(1400, 100)
  await expect(sidebar).toHaveCSS('width', '420px')
  await page.mouse.up()
  await expect(handle).toHaveAttribute('data-dragging', 'false')
  await page.reload()
  await expect(sidebar).toHaveCSS('width', '420px')

  await page.evaluate(() => {
    localStorage.setItem(
      'wuwa-viewer-sidebar-width',
      JSON.stringify({ width: 720, viewportWidth: window.innerWidth, screenWidth: screen.width }),
    )
  })
  await page.reload()
  await expect(sidebar).toHaveCSS('width', '420px')

  await page.addInitScript(() => {
    Object.defineProperty(window.screen, 'width', { value: window.screen.width + 1 })
  })
  await page.reload()
  await expect(sidebar).toHaveCSS('width', '320px')
  await handle.hover()
  await page.mouse.down()
  await page.mouse.move(405, 100)
  await page.mouse.up()
  await expect(sidebar).toHaveCSS('width', '400px')

  await page.setViewportSize({ width: 1000, height: 900 })
  await expect(sidebar).toHaveCSS('width', '280px')
  await handle.hover()
  await page.mouse.down()
  await page.mouse.move(800, 100)
  await expect(workspace).toHaveCSS('width', '600px')
  await page.setViewportSize({ width: 900, height: 900 })
  await page.mouse.up()
  await expect(handle).toBeHidden()
  await page.getByTestId('打开导航').click()
  await expect(sidebar).toHaveAttribute('data-open', 'true')
})

test('double-clicking the sidebar handle resets and clears the saved width', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Requires the docked sidebar')
  await page.goto('/')
  const sidebar = page.locator('.sidebar')
  const handle = page.locator('.sidebar-resize-handle')
  await handle.hover()
  await page.mouse.down()
  await page.mouse.move(405, 100)
  await page.mouse.up()
  await expect(sidebar).toHaveCSS('width', '400px')
  const savedWidth = () => page.evaluate(() => localStorage.getItem('wuwa-viewer-sidebar-width'))
  expect(await savedWidth()).toBeTruthy()

  await handle.dblclick()
  await expect(sidebar).toHaveCSS('width', '320px')
  expect(await savedWidth()).toBeNull()
  await page.reload()
  await expect(sidebar).toHaveCSS('width', '320px')
})

test('real export, category browsing, filters and detail', async ({ page }, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const list = page.getByTestId('成就列表')
  await expect(list).toHaveAttribute('data-count', '1305')
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('overview.png'), fullPage: false })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
  const hideCompleted = page.getByTestId('隐藏已完成')
  await page.locator('.hide-completed .w-checkbox-label').click()
  await expect(hideCompleted).toBeChecked()
  await expect(list).toHaveAttribute('data-count', '1250')
  await hideCompleted.press('Space')
  await expect(hideCompleted).not.toBeChecked()
  const search = page.getByTestId('搜索成就')
  await hideCompleted.press('/')
  await expect(search).not.toBeFocused()
  await search.fill('100101')
  await expect(page.locator('.achievement-row')).toHaveCount(1)
  await expect(page.locator('.achievement-title')).toContainText('抛瓦')
  await expect(page.getByTestId('文本语言')).toHaveCount(0)

  await page.getByTestId('查看成就详情 100101').click()
  const dialog = page.locator('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('#detail-title')).toHaveText('抛瓦！')
  const row = page.getByTestId('成就卡片 100101')
  await expect(row).toHaveAttribute('data-completed', 'false')
  await expect(dialog.getByText('多语言对照')).toHaveCount(0)
  await page.getByTestId('关闭详情').click()
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(page.locator('body')).toBeFocused()

  const description = (await page.locator('.achievement-description').boundingBox())!
  await page.mouse.click(description.x + 2, description.y + description.height / 2)
  await expect(row).toHaveAttribute('data-completed', 'true')
  await expect(dialog).toHaveCount(0)
  await row.press('Space')
  await expect(row).toHaveAttribute('data-completed', 'false')

  await page.getByTestId('清空搜索').click()
  if (testInfo.project.name === 'mobile') await page.getByTestId('打开导航').click()
  const allAchievements = page.locator('button.nav-overview-heading')
  await expect(allAchievements).toContainText('全部成就')
  await expect(allAchievements).toHaveAttribute('data-selected', 'true')
  await expect(page.locator('.category-nav-row button')).toHaveCount(0)
  const group = page.locator('.sub-navigation > button').filter({ hasText: '索拉的大地·瑝珑' })
  await group.click()
  await expect(group).toHaveAttribute('data-selected', 'true')
  await expect(allAchievements).toHaveAttribute('data-selected', 'false')
  await expect(list).toHaveAttribute('data-count', '75')
  await list
    .getByTestId(/^查看成就详情 /)
    .first()
    .click()
  await expect(dialog.getByText('索拉漫行 / 索拉的大地·瑝珑', { exact: true })).toBeVisible()
  await page.getByTestId('关闭详情').click()
  await expect(page.locator('dialog')).toHaveCount(0)
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  const lastGroupRow = list.locator('[data-index="74"] .achievement-row')
  await expect(lastGroupRow).toBeInViewport()
  await expect(page.getByTestId('搜索成就')).toBeInViewport()
  if (testInfo.project.name === 'mobile') await page.getByTestId('打开导航').click()
  await expect(page.getByRole('button', { name: /其他玩法/ })).toHaveCount(0)
  await group.click()
  await expect(group).toHaveAttribute('data-selected', 'true')
  await expect(allAchievements).toHaveAttribute('data-selected', 'false')
  await expect(list).toHaveAttribute('data-count', '75')
  await expect(lastGroupRow).toBeInViewport()
  if (testInfo.project.name === 'mobile') await page.getByTestId('打开导航').click()
  await allAchievements.click()
  await expect(group).toHaveAttribute('data-selected', 'false')
  await expect(allAchievements).toHaveAttribute('data-selected', 'true')
  await expect(list).toHaveAttribute('data-count', '1305')
  await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0)
  await page.getByTestId('搜索成就').fill('no-such-achievement-99999')
  await expect(page.getByText('没有找到匹配的成就', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('card stars and progress text match standalone and linked achievements', async ({ page }) => {
  await page.goto('/')
  const search = page.getByTestId('搜索成就')
  const cases = [
    { id: '100101', slots: 1, lit: 0 },
    { id: '100108', slots: 2, lit: 2 },
    { id: '100227', slots: 3, lit: 0 },
    { id: '100114', slots: 3, lit: 3 },
    { id: '100403', slots: 3, lit: 0, progress: '4/100' },
    { id: '400113', slots: 3, lit: 1, progress: '8/15' },
    { id: '400106', slots: 3, lit: 2 },
    { id: '110103', slots: 3, lit: 3 },
  ]

  for (const { id, slots, lit, progress } of cases) {
    await search.fill(id)
    const card = page.locator('.achievement-card').filter({
      has: page.getByTestId(`成就卡片 ${id}`),
    })
    const emblem = card.locator('.achievement-emblem')
    await expect(emblem.locator('.achievement-emblem-background')).toBeVisible()
    await expect(emblem.locator('img[data-lit]')).toHaveCount(slots)
    await expect(emblem.locator('img[data-lit=true]')).toHaveCount(lit)
    if (progress) {
      await expect(card.locator('.row-progress')).toHaveText(progress)
    } else {
      await expect(card.locator('.row-progress')).toHaveCount(0)
    }
    await expect(card.locator('.mini-track, .status[data-finished=true]')).toHaveCount(0)
    await expect
      .poll(() =>
        emblem
          .locator('img')
          .evaluateAll((images) =>
            images.every((image) => image instanceof HTMLImageElement && image.naturalWidth > 0),
          ),
      )
      .toBe(true)
  }
})

test('JSON import is validated and errors preserve the previous snapshot', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1305')
  const input = page.getByTestId('导入成就 JSON 文件')
  const fileChooser = page.waitForEvent('filechooser')
  await page.getByTestId('import-achievement-file').click()
  await (
    await fileChooser
  ).setFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{bad'),
  })
  await expect(page.locator('.w-message[data-type="error"]')).toContainText('JSON 格式错误')
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1305')
  await input.setInputFiles(fileURLToPath(fixture))
  await expect(page.locator('.w-message[data-type="error"]')).toHaveCount(0)
  await page.getByTestId('档案更多操作').click()
  await page.getByTestId('export-achievement-file').hover()
  await expect(page.locator('.w-tooltip')).toHaveText('导出成就文件')
  const download = page.waitForEvent('download')
  await page.getByTestId('export-achievement-file').click()
  expect((await download).suggestedFilename()).toBe(
    'Wuthering-Waves-Achievements-unknown-20261113-231228Z.json',
  )
})

test('linked achievements unlock after completing the previous one', async ({ page }, testInfo) => {
  await page.goto('/')
  await page.getByTestId('搜索成就').fill('100411')
  const rows = page.locator('.achievement-row')
  const details = page.getByTestId(/^查看成就详情 /)
  const firstToggle = rows.nth(0)
  const secondToggle = rows.nth(1)
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(1)).toHaveAttribute('data-waiting', 'true')
  await expect(rows.nth(2)).toHaveAttribute('data-waiting', 'true')
  await expect(secondToggle.locator('.achievement-emblem')).toHaveAttribute('data-lit', '0')
  await expect(secondToggle).toBeDisabled()
  if (testInfo.project.name === 'desktop') {
    await secondToggle.hover()
    await expect(page.locator('.w-tooltip')).toHaveText('请先完成前一阶段')
  }
  await details.nth(1).click()
  const edit = page.getByTestId('编辑成就完成状态')
  await expect(edit).toBeDisabled()
  await expect(page.getByTestId('成就阶段')).toHaveCount(0)
  await page.getByTestId('关闭详情').click()
  await firstToggle.press('Space')
  await expect(rows.nth(0)).toHaveAttribute('data-completed', 'true')
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(secondToggle).toBeEnabled()
  await details.nth(1).click()
  await expect(edit).toBeEnabled()
  await expect(edit).not.toBeChecked()
  await expect(rows.nth(1)).toHaveAttribute('data-waiting', 'false')
  await expect(rows.nth(2)).toHaveAttribute('data-waiting', 'true')
  await expect(secondToggle.locator('.achievement-emblem')).toHaveAttribute('data-lit', '1')
  await page.getByTestId('关闭详情').click()
  await details.nth(0).click()
  await edit.click()
  await expect(edit).not.toBeChecked()
  await expect(rows.nth(1)).toHaveAttribute('data-waiting', 'true')
  await page.getByTestId('关闭详情').click()
  await firstToggle.click()
  await expect(rows.nth(0)).toHaveAttribute('data-completed', 'true')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.screenshot({
    path: testInfo.outputPath('completed-card-dark.png'),
    animations: 'disabled',
  })
  await firstToggle.click()
  await expect(rows.nth(0)).toHaveAttribute('data-completed', 'false')
  await expect(page.locator('dialog')).toHaveCount(0)
})

test('hidden achievements can be filtered with completion and search', async ({ page }) => {
  await page.goto('/')
  const list = page.getByTestId('成就列表')
  const hiddenOnly = page.getByTestId('只看隐藏成就')
  const hideCompleted = page.getByTestId('隐藏已完成')
  const search = page.getByTestId('搜索成就')

  await expect(hiddenOnly).not.toBeChecked()
  await hiddenOnly.check()
  await expect(list).toHaveAttribute('data-count', '268')
  await hideCompleted.check()
  await expect(list).toHaveAttribute('data-count', '264')
  await hiddenOnly.uncheck()
  await expect(list).toHaveAttribute('data-count', '1250')

  await hiddenOnly.check()
  await search.fill('100101')
  await expect(list).toHaveAttribute('data-count', '0')
  await page.getByText('清除搜索与筛选', { exact: true }).click()
  await expect(hiddenOnly).not.toBeChecked()
  await expect(hideCompleted).not.toBeChecked()
  await expect(search).toHaveValue('')
  await expect(list).toHaveAttribute('data-count', '1305')
})

test('hide completed keeps the current results until a filter is reapplied', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const search = page.getByTestId('搜索成就')
  const list = page.getByTestId('成就列表')
  const row = page.getByTestId('成就卡片 100101')
  const hideCompleted = page.locator('.hide-completed .w-checkbox-label')

  await search.fill('100101')
  await hideCompleted.click()
  await row.click()
  await expect(row).toHaveAttribute('data-completed', 'true')
  await expect(list).toHaveAttribute('data-count', '1')
  await row.click()
  await expect(row).toHaveAttribute('data-completed', 'false')
  await expect(list).toHaveAttribute('data-count', '1')
  await row.click()
  await expect(row).toHaveAttribute('data-completed', 'true')

  await search.fill('抛瓦！')
  await expect(list).toHaveAttribute('data-count', '0')
  await hideCompleted.click()
  await expect(row).toHaveAttribute('data-completed', 'true')
  await row.click()
  await hideCompleted.click()
  await row.click()
  await expect(list).toHaveAttribute('data-count', '1')
  await hideCompleted.click()
  await hideCompleted.click()
  await expect(list).toHaveAttribute('data-count', '0')

  await hideCompleted.click()
  await row.click()
  await hideCompleted.click()
  await row.click()
  await expect(list).toHaveAttribute('data-count', '1')
  if (testInfo.project.name === 'mobile') await page.getByTestId('打开导航').click()
  await page.locator('.sub-navigation > button').filter({ hasText: '索拉的大地·瑝珑' }).click()
  await expect(list).toHaveAttribute('data-count', '0')

  await page.reload()
  await search.fill('100101')
  await expect(row).toHaveAttribute('data-completed', 'true')
})

test('completion updates the list and detail before saving and restores both on write failure', async ({
  page,
}) => {
  await page.goto('/')
  const row = page.getByTestId('成就卡片 100101')
  await page.getByTestId('查看成就详情 100101').click()
  const edit = page.getByTestId('编辑成就完成状态')
  await expect(edit).toBeEnabled()
  await expect(edit).not.toBeChecked()

  await edit.evaluate((checkbox: HTMLInputElement) => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value, key) {
      if (this.name !== 'accounts') return put.call(this, value, key)
      IDBObjectStore.prototype.put = put
      checkbox.dataset.checkedDuringSave = String(checkbox.checked)
      checkbox.dataset.opacityDuringSave = getComputedStyle(checkbox.closest('label')!).opacity
      const toggle = document.querySelector<HTMLButtonElement>('[data-testid="成就卡片 100101"]')!
      checkbox.dataset.cardDuringSave = toggle.dataset.completed
      checkbox.dataset.toggleEnabledDuringSave = String(!toggle.disabled)
      throw new Error('Test write failure')
    }
  })

  await edit.click()
  await expect(edit).toHaveAttribute('data-checked-during-save', 'true')
  await expect(edit).toHaveAttribute('data-opacity-during-save', '1')
  await expect(edit).toHaveAttribute('data-card-during-save', 'true')
  await expect(edit).toHaveAttribute('data-toggle-enabled-during-save', 'true')
  await expect(page.locator('.w-message[data-type="error"]')).toContainText('Test write failure')
  await expect(edit).not.toBeChecked()
  await expect(row).toHaveAttribute('data-completed', 'false')
  await edit.click()
  await expect(edit).toBeChecked()
  await expect(row.locator('.achievement-emblem')).toHaveAttribute('data-lit', '1')
})

test('the card can toggle again before the first change finishes saving', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('搜索成就').fill('100101')
  const row = page.getByTestId('成就卡片 100101')
  await expect(row).toBeEnabled()

  await page.evaluate(() => {
    const open = indexedDB.open
    indexedDB.open = function (...args) {
      indexedDB.open = open
      const request = open.apply(this, args)
      Object.defineProperty(request, 'onsuccess', {
        set(onSuccess: (event: Event) => void) {
          request.addEventListener('success', (event) => {
            window.addEventListener('release-completion-save', () => onSuccess(event), {
              once: true,
            })
            document.documentElement.dataset.completionSaveHeld = 'true'
          })
        },
      })
      return request
    }
  })

  await row.click()
  await expect(page.locator('html')).toHaveAttribute('data-completion-save-held', 'true')
  await expect(row).toHaveAttribute('data-completed', 'true')
  await expect(row).toHaveCSS('cursor', 'pointer')
  await row.click()
  await expect(row).toHaveAttribute('data-completed', 'false')
  await page.evaluate(() => window.dispatchEvent(new Event('release-completion-save')))

  await expect
    .poll(() =>
      page.evaluate(async () => {
        const read = <T>(request: IDBRequest<T>) =>
          new Promise<T>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
        const db = await read(indexedDB.open('wuwa-achievement-archive'))
        try {
          const archive = await read(
            db.transaction('accounts').objectStore('accounts').get('default'),
          )
          return archive?.achievements.find((item: { id: number }) => item.id === 100101)?.status
        } finally {
          db.close()
        }
      }),
    )
    .toBe('in_progress')
  await expect(row).toHaveAttribute('data-completed', 'false')
})

test('archive actions animate on entry and stay mounted through exit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const trigger = page.getByTestId('档案更多操作')
  const menu = page.locator('.archive-actions-menu')
  await expect(trigger).toBeEnabled()
  await expect(menu).toHaveCount(0)

  const transitions = await trigger.evaluate(async (element) => {
    if (!(element instanceof HTMLButtonElement)) return []
    element.click()
    await new Promise(requestAnimationFrame)
    const menu = document.querySelector('.archive-actions-menu')
    return menu
      ?.getAnimations()
      .map((animation) => (animation instanceof CSSTransition ? animation.transitionProperty : ''))
  })
  expect(transitions).toContain('opacity')
  await expect(menu).toBeVisible()
  await menu.evaluate((element) =>
    Promise.allSettled(element.getAnimations().map((animation) => animation.finished)),
  )
  await trigger.press('Escape')
  await expect(menu).toHaveAttribute('data-state', 'closing')
  await expect(menu).toHaveCount(0)
})

test('archive actions tolerate brief mouse passes and exits', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByTestId('档案更多操作')
  const menu = page.locator('.archive-actions-menu')
  await expect(trigger).toBeEnabled()
  await page.clock.install()
  await page.clock.pauseAt(Date.now() + 60_000)
  const box = (await trigger.boundingBox())!
  const hover = () => page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await hover()
  await page.clock.runFor(50)
  await expect(menu).toHaveCount(0)
  await page.mouse.move(0, 0)
  await page.clock.runFor(250)
  await expect(menu).toHaveCount(0)
  await hover()
  await page.clock.runFor(250)
  await expect(menu).toBeVisible()

  const download = page.getByTestId('export-achievement-file')
  const downloadBox = (await download.boundingBox())!
  const hoverDownload = () =>
    page.mouse.move(downloadBox.x + downloadBox.width / 2, downloadBox.y + downloadBox.height / 2)
  await hoverDownload()
  await page.mouse.move(0, 0)
  await page.clock.runFor(175)
  await expect(menu).toHaveAttribute('data-state', 'open')
  await hoverDownload()
  await page.clock.runFor(350)
  await expect(menu).toHaveAttribute('data-state', 'open')
  await page.mouse.move(0, 0)
  await page.clock.runFor(350)
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
})

test('sidebar shows a check in place of counts for completed categories and groups', async ({
  page,
}) => {
  const data = JSON.parse(await readFile(fixture, 'utf8'))
  const categoryId = data.categories[0].id
  for (const item of data.achievements) {
    if (item.categoryId === categoryId) item.status = 'completed'
  }
  await page.goto('/')
  await page.getByTestId('导入成就 JSON 文件').setInputFiles({
    name: 'achievements.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  })
  const categories = page.locator('.category-nav-row')
  const menu = page.getByTestId('打开导航')
  if (await menu.isVisible()) await menu.click()
  await expect(categories.first().locator('.nav-completion-icon')).toBeVisible()
  await expect(categories.first().locator('.nav-count')).toHaveCount(0)
  await expect(categories.nth(1).locator('.nav-completion-icon')).toHaveCount(0)
  await expect(categories.nth(1).locator('.nav-count')).toHaveText(/^\d+\/\d+$/)
  const group = page
    .locator('.sub-navigation > button')
    .filter({
      has: page.locator('.nav-completion-icon'),
    })
    .first()
  await expect(group.locator('.nav-completion-icon')).toBeVisible()
  await expect(group.locator('.nav-count')).toHaveCount(0)
})

test('detail dialog completes its exit and can reopen during it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const details = page.getByTestId(/^查看成就详情 /).first()
  const dialog = page.locator('.w-dialog')
  await details.click()
  await expect(dialog).toHaveJSProperty('open', true)
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )

  const reopened = await details.evaluate(async (trigger) => {
    if (!(trigger instanceof HTMLButtonElement)) return false
    const dialog = document.querySelector<HTMLDialogElement>('.w-dialog')!
    dialog.querySelector<HTMLButtonElement>('[data-testid="关闭详情"]')!.click()
    await new Promise(requestAnimationFrame)
    const exitAnimations = dialog.getAnimations()
    if (dialog.open || exitAnimations.length === 0) return false
    trigger.click()
    await Promise.allSettled(exitAnimations.map((animation) => animation.finished))
    await new Promise(requestAnimationFrame)
    return dialog.isConnected && dialog.open
  })
  expect(reopened).toBe(true)

  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)

  await details.press('Enter')
  await expect(dialog).toHaveJSProperty('open', true)
  await expect(page.getByTestId('关闭详情')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.locator('body')).toBeFocused()
})

test('missing default export can recover through local import', async ({ page }) => {
  await page.route('**/data/achievement-catalog.png', (route) => route.fulfill({ status: 404 }))
  await page.goto('/')
  await expect(page.locator('.w-message[data-type="error"]')).toContainText('未找到本地导出')
  await page.getByTestId('导入成就 JSON 文件').setInputFiles(fileURLToPath(fixture))
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1305')
  await expect(page.locator('.w-message[data-type="error"]')).toHaveCount(0)
})
