import { expect, test } from '@playwright/test'

test('buttons clear pointer focus and preserve keyboard activation', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByTestId('版本筛选')
  await trigger.click()
  await expect(trigger).toHaveAttribute('data-expanded', 'true')
  await expect(trigger).not.toBeFocused()
  await page.getByTestId('搜索成就').click()
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
  await expect(trigger).not.toBeFocused()

  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('data-expanded', 'true')
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Space')
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('select keeps keyboard control after opening with a pointer', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByTestId('theme-switch')
  await trigger.click()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('End')
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('data-value', 'dark')
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
  await expect(trigger).toBeFocused()
})

test('desktop action buttons clear pointer focus and still run their action', async ({ page }) => {
  await page.goto('/desktop')
  const button = page.getByTestId('开始采集')
  await button.click()
  await expect(page.locator('.w-message[data-type="error"]')).toBeVisible()
  await expect(button).not.toBeFocused()
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(button).toBeFocused()
})
