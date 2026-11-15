import { expect, test } from '@playwright/test'

test('WSvg loads bundled icons once and keeps cloned nodes independent', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  const icons = page.locator('svg.w-svg')
  await expect.poll(() => icons.count()).toBeGreaterThan(10)
  await expect
    .poll(() =>
      icons.evaluateAll((elements) => elements.every((element) => element.childElementCount > 0)),
    )
    .toBeTruthy()
  expect(
    await icons.evaluateAll((elements) =>
      elements.every((element) => element.getAttribute('viewBox') === '0 0 24 24'),
    ),
  ).toBeTruthy()
  expect(
    await icons.evaluateAll((elements) =>
      elements.every((element) => !element.hasAttribute('aria-hidden')),
    ),
  ).toBeTruthy()
  const sidebar = page.locator('.sidebar')
  const tabImage = sidebar.locator('.nav-overview-heading > img')
  await expect(tabImage).toHaveAttribute('src', /\/achievement-tab(?:-[\w-]+)?\.png(?:\?|$)/)
  const astrite = sidebar.locator('.archive-summary-item > img')
  await expect(astrite).toHaveAttribute('src', /\/astrite(?:-[\w-]+)?\.png(?:\?|$)/)
  const cardAstrite = page.locator('.row-reward > img').first()
  await expect(cardAstrite).toHaveAttribute('src', (await astrite.getAttribute('src'))!)
  await cardAstrite.evaluate((image) => (image as HTMLImageElement).decode())
  const categoryIcons = sidebar.locator('.category-nav-row > img')
  await expect(categoryIcons).toHaveCount(4)
  for (const category of [1, 2, 3, 4]) {
    await expect(categoryIcons.nth(category - 1)).toHaveAttribute(
      'src',
      new RegExp(`/achievement-category-${category}(?:-[\\w-]+)?\\.png(?:\\?|$)`),
    )
  }
  const groupIcons = sidebar.locator('.sub-navigation img.group-icon')
  await expect(groupIcons).toHaveCount(36)
  const sharedIcons = groupIcons.and(sidebar.locator('[src*="achievement-group-022"]'))
  await expect(sharedIcons).toHaveCount(2)
  expect(await sharedIcons.first().getAttribute('src')).toBe(
    await sharedIcons.last().getAttribute('src'),
  )
  await sidebar
    .locator('img')
    .evaluateAll((images) =>
      Promise.all(images.map((image) => (image as HTMLImageElement).decode())),
    )
  const trigger = page.getByTestId('theme-switch')
  await trigger.click()
  await expect(page.locator('[popover] svg[data-icon="check"] > path')).toHaveCount(1)
  await page.locator('.w-select-option[data-value="dark"]').click()
  await expect(page.locator('[popover]')).toHaveCount(0)
  await trigger.click()
  await expect(page.locator('.w-select-option[data-value="dark"]')).toHaveAttribute(
    'data-selected',
    'true',
  )
  await expect(page.locator('[popover] svg[data-icon="check"] > path')).toHaveCount(1)
  await trigger.press('Escape')
  expect(
    await page.evaluate(
      () =>
        performance
          .getEntriesByType('resource')
          .filter((entry) => /\/svg(?:\.ts|-[^/]+\.js)/.test(entry.name)).length,
    ),
  ).toBe(1)
  expect(errors).toEqual([])
})
