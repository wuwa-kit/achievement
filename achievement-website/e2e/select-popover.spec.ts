import { expect, test } from '@playwright/test'

for (const route of ['/', '/desktop']) {
  test(`select closes on repeated trigger clicks on ${route}`, async ({ page, isMobile }) => {
    await page.goto(route)
    const trigger = page.getByTestId('theme-switch')
    const popover = page.locator('.w-select-popover')
    await expect(trigger).toBeEnabled()
    const value = await trigger.getAttribute('data-value')
    const clickTrigger = () => (isMobile ? trigger.tap() : trigger.click())

    for (let attempt = 0; attempt < 2; attempt++) {
      await clickTrigger()
      await expect(trigger).toHaveAttribute('data-expanded', 'true')
      await expect(page.locator('.w-select-popover:popover-open')).toHaveCount(1)
      await clickTrigger()
      await expect(trigger).toHaveAttribute('data-expanded', 'false')
      await expect(popover).toHaveCount(0)
      await expect(trigger).toHaveAttribute('data-value', value!)
    }
  })
}

test('popover mounts only for entry, open and exit; supports keyboard and interruption', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.workspace')).toBeVisible()
  const trigger = page.getByTestId('theme-switch')
  await expect(trigger).toBeVisible()
  await expect(page.locator('select')).toHaveCount(0)
  const popover = page.locator('.w-select-popover')
  await expect(popover).toHaveCount(0)
  await trigger.focus()
  await trigger.press('ArrowDown')
  await expect(popover).toHaveCount(1)
  await expect(popover).toHaveJSProperty('popover', 'auto')
  await expect(page.locator('.w-select-popover:popover-open')).toHaveCount(1)
  await trigger.press('End')
  await trigger.press('Enter')
  await expect(trigger).toHaveAttribute('data-value', 'dark')
  await expect(trigger).toBeFocused()
  await expect(popover).toHaveCount(0)
  await trigger.click()
  // Wait until the entry transition has settled, then inspect synchronous exit state.
  await popover.evaluate(async (element) => {
    await Promise.allSettled(element.getAnimations().map((a) => a.finished))
  })
  const closing = await popover.evaluate((element) => {
    if (!(element instanceof HTMLElement)) throw new Error('Expected HTML popover')
    element.hidePopover()
    return {
      connected: element.isConnected,
      open: element.matches(':popover-open'),
      animations: element.getAnimations().length,
    }
  })
  expect(closing).toMatchObject({ connected: true, open: false })
  expect(closing.animations).toBeGreaterThan(0)
  await expect(popover).toHaveCount(0)
  await trigger.click()
  await trigger.press('Escape')
  await trigger.click()
  await expect(trigger).toHaveAttribute('data-expanded', 'true')
  await expect(page.locator('.w-select-popover:popover-open')).toHaveCount(1)
  await page.getByTestId('搜索成就').click()
  await expect(popover).toHaveCount(0)
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
  expect(errors).toEqual([])
})

test('reduced motion closes without retaining hidden DOM and popover stays within viewport', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(page.locator('.workspace')).toBeVisible()
  const trigger = page.locator('.w-language-switch')
  await trigger.click()
  const popover = page.locator('[popover]:popover-open')
  await expect(popover).toBeVisible()
  const bounds = await popover.boundingBox()
  const viewport = page.viewportSize()!
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1)
  await page.screenshot({ path: test.info().outputPath('select-open.png') })
  expect(errors).toEqual([])
  await trigger.press('Tab')
  await expect(page.locator('[popover]')).toHaveCount(0)
})
