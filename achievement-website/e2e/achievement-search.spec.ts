import { expect, test } from '@playwright/test'
import { catalogPng } from '../build/catalog-png'
import { readCatalogResponse } from './catalog-helpers'

test('numeric searches match descriptions while achievement IDs require the complete value', async ({
  page,
}) => {
  await page.goto('/')
  const search = page.getByTestId('搜索成就')
  const exactId = page.getByTestId('成就卡片 100101')
  await search.fill('100')
  await expect(
    page.locator('.achievement-description').filter({ hasText: '100' }).first(),
  ).toBeVisible()
  await expect(exactId).toHaveCount(0)
  await search.fill('100101')
  await expect(exactId).toBeVisible()
  await search.fill('10010')
  await expect(exactId).toHaveCount(0)
})

test('hidden icon explains its status and card search opens without a detail dialog', async ({
  page,
  context,
}, testInfo) => {
  await page.goto('/')
  await page.getByTestId('搜索成就').fill('100108')
  const card = page.locator('.achievement-card').filter({
    has: page.getByTestId('成就卡片 100108'),
  })
  const row = page.getByTestId('成就卡片 100108')
  const hidden = card.locator('.hidden-badge')
  const search = card.getByTestId('search-achievement-online-100108')
  await expect(hidden).toBeVisible()
  await expect(hidden).toHaveText('')
  await hidden.hover()
  await expect(page.locator('.w-tooltip')).toHaveText('隐藏成就')
  await search.hover()
  await expect(page.locator('.w-tooltip')).toHaveText('在 哔哩哔哩 搜索此成就')

  const completed = await row.getAttribute('data-completed')
  const searchUrl = (await search.getAttribute('href'))!
  await context.route(searchUrl, (route) => route.fulfill({ body: 'Search results' }))
  const [popup] = await Promise.all([page.waitForEvent('popup'), search.click()])
  await expect(popup).toHaveURL(searchUrl)
  await popup.close()
  await expect(search).not.toBeFocused()
  await expect(page.locator('.w-tooltip')).toHaveCount(0)
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(row).toHaveAttribute('data-completed', completed!)

  await page.getByTestId('查看成就详情 100108').focus()
  await page.keyboard.press('Tab')
  await expect(search).toBeFocused()
  const [keyboardPopup] = await Promise.all([page.waitForEvent('popup'), search.press('Enter')])
  await expect(keyboardPopup).toHaveURL(searchUrl)
  await keyboardPopup.close()
  await expect(search).toBeFocused()

  await page.getByTestId('查看成就详情 100108').click()
  const detail = page.getByTestId('成就详情内容')
  await expect(detail).toBeVisible()
  await expect(detail.getByTestId('search-achievement-online')).toHaveAttribute('href', searchUrl)
  await expect(detail.locator('.hidden-badge')).toHaveText('')
  await page.getByTestId('关闭详情').click()
  await expect(page.locator('dialog')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.screenshot({ path: testInfo.outputPath('compact-title.png') })
})

for (const longTitle of [false, true]) {
  test(`expanded search target avoids title and completion actions${longTitle ? ' with a wrapped title' : ''}`, async ({
    page,
    context,
  }) => {
    if (longTitle) {
      await page.route('**/data/achievement-catalog.png', async (route) => {
        const data = await readCatalogResponse(await route.fetch())
        const item = data.achievements.find(({ id }) => id === 100108)!
        item.texts['zh-Hans'].title = item.texts['zh-Hans'].title!.repeat(20)
        await route.fulfill({ contentType: 'image/png', body: catalogPng(JSON.stringify(data)) })
      })
    }
    await page.goto('/')
    await page.getByTestId('搜索成就').fill('100108')
    const search = page.getByTestId('search-achievement-online-100108')
    const title = page.getByTestId('查看成就详情 100108')
    await expect(search).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const bounds = (await search.boundingBox())!
    const titleBounds = (await title.locator('.achievement-title-text').boundingBox())!
    const edges = [
      { x: bounds.x - 6, y: bounds.y + bounds.height / 2 },
      { x: bounds.x + bounds.width + 6, y: bounds.y + bounds.height / 2 },
      { x: bounds.x + bounds.width / 2, y: bounds.y - 6 },
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height + 6 },
    ]
    const hitTarget = (point: { x: number; y: number }) =>
      page.evaluate(
        ({ x, y }) =>
          document.elementFromPoint(x, y)?.closest('a, button')?.getAttribute('data-testid'),
        point,
      )
    for (const point of edges) {
      expect(await hitTarget(point)).toBe('search-achievement-online-100108')
    }
    expect(
      await hitTarget({
        x: titleBounds.x + titleBounds.width - 1,
        y: titleBounds.y + titleBounds.height / 2,
      }),
    ).toBe('查看成就详情 100108')

    await page.mouse.move(edges[0].x, edges[0].y)
    await expect(page.locator('.w-tooltip')).toHaveText('在 哔哩哔哩 搜索此成就')
    const row = page.getByTestId('成就卡片 100108')
    const completed = await row.getAttribute('data-completed')
    const searchUrl = (await search.getAttribute('href'))!
    await context.route(searchUrl, (route) => route.fulfill({ body: 'Search results' }))
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.mouse.click(edges[0].x, edges[0].y),
    ])
    await expect(popup).toHaveURL(searchUrl)
    await popup.close()
    await expect(row).toHaveAttribute('data-completed', completed!)
    await expect(page.locator('dialog')).toHaveCount(0)
    await page.mouse.click(
      titleBounds.x + titleBounds.width - 1,
      titleBounds.y + titleBounds.height / 2,
    )
    await expect(page.getByTestId('成就详情内容')).toBeVisible()
  })
}
