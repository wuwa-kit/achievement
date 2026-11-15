import { expect, test } from '@playwright/test'

test('achievement matches are painted without changing layout', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/')
  const search = page.getByTestId('搜索成就')
  const card = page.locator('.achievement-card').filter({
    has: page.getByTestId('成就卡片 100108'),
  })
  const highlighted = () =>
    page.evaluate(() => CSS.highlights.get('achievement-search-match')?.size ?? 0)
  const layout = () =>
    card
      .locator('.achievement-title-text, .achievement-description')
      .evaluateAll(async (elements) => {
        await document.fonts.ready
        return elements.map((element) => {
          const { width, height } = element.getBoundingClientRect()
          return { width, height, text: element.textContent, nodes: element.childNodes.length }
        })
      })
  const color = () =>
    card
      .locator('.achievement-title-text')
      .evaluate(
        (element) => getComputedStyle(element, '::highlight(achievement-search-match)').color,
      )
  await search.fill('100108')
  await expect(card).toBeVisible()
  expect(await highlighted()).toBe(0)
  const before = await layout()
  await search.fill('  激光  ')
  await expect
    .poll(() =>
      card.evaluate((element) =>
        Array.from(CSS.highlights.get('achievement-search-match') ?? [])
          .filter((range) => element.contains(range.startContainer))
          .map(({ startContainer, startOffset, endOffset }) => [
            startContainer.parentElement?.classList[0],
            startContainer.textContent?.slice(startOffset, endOffset),
          ]),
      ),
    )
    .toEqual(
      expect.arrayContaining([
        ['achievement-title-text', '激光'],
        ['achievement-description', '激光'],
      ]),
    )
  expect(await layout()).toEqual(before)
  expect(await color()).toBe('rgb(30, 142, 252)')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect.poll(color).toBe('rgb(112, 186, 255)')
  await page.getByTestId('查看成就详情 100108').click()
  await expect(page.locator('#detail-title')).toHaveText('激光中起舞')
  expect(
    await page
      .locator('#detail-title')
      .evaluate((element) =>
        Array.from(CSS.highlights.get('achievement-search-match') ?? []).some(
          ({ startContainer, startOffset, endOffset }) =>
            startContainer.parentElement === element &&
            startContainer.textContent?.slice(startOffset, endOffset) === '激光',
        ),
      ),
  ).toBe(true)
  await page.getByTestId('关闭详情').click()
  await page.getByTestId('清空搜索').click()
  await expect.poll(highlighted).toBe(0)
})
