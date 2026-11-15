import { expect, test } from '@playwright/test'
import { selectValue } from './select-helpers'

test('ellipsis tooltip follows actual overflow, resizing and language changes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/desktop')
  const description = page.locator('.desktop-description')
  await expect(description).toHaveAttribute('data-truncated', 'true')
  const original = await description.textContent()
  await description.hover()
  await expect(page.locator('.w-tooltip')).toHaveText(original!)

  // Growing the container closes an already-open overflow tooltip.
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(description).toHaveAttribute('data-truncated', 'false')
  await expect(page.locator('.w-tooltip')).toHaveCount(0)
  await page.mouse.move(0, 0)
  await description.hover()
  await page.waitForTimeout(400)
  await expect(page.locator('.w-tooltip')).toHaveCount(0)

  // A longer translation can overflow the same container without a viewport change.
  await selectValue(page, page.locator('.w-language-switch'), 'de')
  await expect(description).toHaveAttribute('data-truncated', 'true')
  await description.hover()
  await expect(page.locator('.w-tooltip')).toHaveText((await description.textContent())!)
  await expect(page.locator('.w-tooltip')).not.toHaveText(original!)
  await page.mouse.move(0, 0)
  await expect(page.locator('.w-tooltip')).toHaveCount(0)
  await expect(description).not.toHaveAttribute('title')
})
