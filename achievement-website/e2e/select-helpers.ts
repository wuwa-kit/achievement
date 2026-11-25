import { expect, type Locator, type Page } from '@playwright/test'

export async function revealToolbarActions(page: Page) {
  if (new URL(page.url()).pathname !== '/' || page.viewportSize()!.width >= 768) return
  const more = page.getByTestId('viewer-more-actions')
  await expect(more).toBeVisible()
  if ((await more.getAttribute('data-expanded')) !== 'true') await more.click()
  await expect(page.locator('.viewer-actions-menu')).toBeVisible()
}

export async function revealArchiveActions(page: Page) {
  if (page.viewportSize()!.width >= 768) return
  const more = page.getByTestId('档案更多操作')
  await expect(more).toBeEnabled()
  if ((await more.getAttribute('data-expanded')) !== 'true') await more.click()
  await expect(page.locator('.archive-actions-menu')).toBeVisible()
}

export async function selectValue(page: Page, trigger: Locator, value: string) {
  if (!(await trigger.isVisible())) await revealToolbarActions(page)
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
