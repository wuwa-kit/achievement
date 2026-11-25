import { expect, test } from '@playwright/test'
import { revealToolbarActions } from './select-helpers'

for (const route of ['/', '/desktop']) {
  test(`external icon link clears pointer focus after returning on ${route}`, async ({
    page,
    context,
  }) => {
    await context.route('https://github.com/wuwa-kit/achievement', (route) =>
      route.fulfill({ body: 'Repository' }),
    )
    await page.goto(route)
    await revealToolbarActions(page)
    const link = page.locator('.open-source-link')
    const labeledLink = route === '/' && page.viewportSize()!.width < 768
    await link.hover()
    if (labeledLink) {
      await page.waitForTimeout(400)
      await expect(page.locator('.w-tooltip')).toHaveCount(0)
    } else await expect(page.locator('.w-tooltip')).toHaveText('开放源代码')
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()])
    await popup.waitForLoadState()
    await popup.close()
    await page.bringToFront()
    await page.mouse.move(0, 0)
    if (labeledLink) await expect(link).toHaveCount(0)
    else await expect(link).not.toBeFocused()
    await page.waitForTimeout(400)
    await expect(page.locator('.w-tooltip')).toHaveCount(0)

    await revealToolbarActions(page)
    await page.keyboard.press('Tab')
    await link.focus()
    await expect(link).toBeFocused()
    if (labeledLink) {
      await page.waitForTimeout(400)
      await expect(page.locator('.w-tooltip')).toHaveCount(0)
    } else await expect(page.locator('.w-tooltip')).toHaveText('开放源代码')
    await page.keyboard.press('Escape')
    await expect(page.locator('.w-tooltip')).toHaveCount(0)
  })
}

test('restored pointer focus does not reopen a button tooltip', async ({ page }) => {
  await page.goto('/desktop')
  const trigger = page.getByTestId('theme-switch')
  await trigger.click()
  await trigger.click()
  await page.mouse.move(0, 0)
  await trigger.evaluate((element) => {
    element.blur()
    element.focus()
  })
  await expect(trigger).toBeFocused()
  await page.waitForTimeout(400)
  await expect(page.locator('.w-tooltip')).toHaveCount(0)
})

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
  await revealToolbarActions(page)
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
