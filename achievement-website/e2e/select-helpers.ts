import { expect, type Locator, type Page } from '@playwright/test'
export async function selectValue(page: Page, trigger: Locator, value: string) {
  await expect(trigger).toBeVisible()
  await trigger.click()
  await page.locator(`[popover]:popover-open .w-select-option[data-value="${value}"]`).click()
  await expect(page.locator('.w-select-popover')).toHaveCount(0)
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
}
export async function expectOptions(page: Page, name: string, expected: number | string[]) {
  const trigger = page.getByTestId(name)
  await trigger.click()
  const options = page.locator('[popover]:popover-open .w-select-option')
  if (typeof expected === 'number') await expect(options).toHaveCount(expected)
  else await expect(options).toHaveText(expected)
  await trigger.press('Escape')
  await expect(page.locator('.w-select-popover')).toHaveCount(0)
}
