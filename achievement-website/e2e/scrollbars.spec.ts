import { expect, test } from '@playwright/test'
import { catalogPng } from '../build/catalog-png'
import { readCatalogResponse } from './catalog-helpers'

test('scrollbar thumb follows the scroll event without ScrollTimeline', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'ScrollTimeline')
  })
  await page.goto('/')
  const list = page.getByTestId('成就列表')
  await expect(list.locator('.achievement-row').first()).toBeVisible()

  const positionError = await list.evaluate(
    (viewport) =>
      new Promise<number>((resolve) => {
        const track = viewport.querySelector('.os-scrollbar-vertical .os-scrollbar-track')!
        const thumb = track.querySelector('.os-scrollbar-handle')!
        const scrollRange = viewport.scrollHeight - viewport.clientHeight
        viewport.addEventListener(
          'scroll',
          () => {
            const trackRect = track.getBoundingClientRect()
            const thumbRect = thumb.getBoundingClientRect()
            const expectedOffset =
              (trackRect.height - thumbRect.height) * (viewport.scrollTop / scrollRange)
            resolve(Math.abs(thumbRect.top - trackRect.top - expectedOffset))
          },
          { once: true },
        )
        viewport.scrollTop = scrollRange / 2
      }),
  )
  expect(positionError).toBeLessThan(1)
})

test('custom scrollbar supports wheel, drag and dialog dismissal', async ({ page }) => {
  await page.route('**/data/achievement-catalog.png', async (route) => {
    const response = await route.fetch()
    const data = await readCatalogResponse(response)
    const item = data.achievements.find(({ id }) => id === 100101)!
    item.texts['zh-Hans'].title = '成就名称'.repeat(40)
    item.texts['zh-Hans'].description = '成就描述'.repeat(160)
    await route.fulfill({ contentType: 'image/png', body: catalogPng(JSON.stringify(data)) })
  })
  await page.setViewportSize({ width: 900, height: 500 })
  await page.goto('/')
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  const list = page.getByTestId('成就列表')
  const scrollbar = list.locator(':scope > .os-scrollbar-vertical')
  await expect(scrollbar).toHaveCount(1)
  const content = list.locator('.achievement-list-content')
  await expect(list).toHaveAttribute('data-count', '1304')
  expect(await content.locator('.achievement-card').count()).toBeLessThan(30)
  const longCard = content.locator('.achievement-card', {
    has: page.getByTestId('成就卡片 100101'),
  })
  await expect(longCard.locator('.achievement-title-text')).toHaveText('成就名称'.repeat(40))
  await expect(longCard.locator('.achievement-description')).toHaveText('成就描述'.repeat(160))
  const lineCount = (element: Element) =>
    element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight)
  expect(await longCard.locator('.achievement-title button').evaluate(lineCount)).toBeGreaterThan(1)
  expect(await longCard.locator('.achievement-description').evaluate(lineCount)).toBeGreaterThan(2)
  const card = await longCard.boundingBox()
  const regularCard = await content
    .locator('.achievement-card', { hasNot: page.getByTestId('成就卡片 100101') })
    .first()
    .boundingBox()
  expect(card!.height).toBeGreaterThan(regularCard!.height)
  expect(Math.abs(regularCard!.y - (card!.y + card!.height) - 6)).toBeLessThan(1)
  await page.mouse.move(800, 350)
  await page.mouse.wheel(0, 450)
  const scrollTop = () => list.evaluate((element) => element.scrollTop)
  await expect.poll(scrollTop).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const handle = scrollbar.locator('.os-scrollbar-handle')
  const beforeDrag = await scrollTop()
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 70, { steps: 8 })
  await page.mouse.up()
  await expect.poll(scrollTop).toBeGreaterThan(beforeDrag)
  const track = scrollbar.locator('.os-scrollbar-track')
  await expect
    .poll(async () => {
      const handleBox = (await handle.boundingBox())!
      const trackBox = (await track.boundingBox())!
      const ratio = await list.evaluate(
        (element) => element.scrollTop / (element.scrollHeight - element.clientHeight),
      )
      return Math.abs(handleBox.y - trackBox.y - ratio * (trackBox.height - handleBox.height))
    })
    .toBeLessThan(2)
  const thumbBox = (await handle.boundingBox())!
  const trackBox = (await track.boundingBox())!
  const thumbX = thumbBox.x + thumbBox.width / 2
  await page.mouse.move(thumbX, thumbBox.y + thumbBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(thumbX, trackBox.y + trackBox.height - 1, { steps: 3 })
  await page.mouse.up()
  await expect(content.locator('[data-card-index="1303"] .achievement-card')).toBeInViewport()
  await list.evaluate((element) => {
    element.scrollTop = 0
  })
  await list
    .getByTestId(/^查看成就详情 /)
    .first()
    .click()
  const details = page.getByTestId('成就详情内容')
  await expect(details).toBeVisible()
  await page.setViewportSize({ width: 900, height: 250 })
  await details.hover()
  await page.mouse.wheel(0, 600)
  await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await details.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe('none')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).toHaveCount(0)
})
