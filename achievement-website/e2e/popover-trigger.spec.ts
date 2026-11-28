import { expect, test } from '@playwright/test'

for (const menu of [
  { trigger: '档案更多操作', panel: '.archive-actions-menu', compact: false },
  { trigger: 'viewer-more-actions', panel: '.viewer-actions-menu', compact: true },
]) {
  test(`${menu.trigger} toggles and dismisses from its trigger`, async ({ page, isMobile }) => {
    if (menu.compact) await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    const trigger = page.getByTestId(menu.trigger)
    const panel = page.locator(menu.panel)
    const clickTrigger = () => (isMobile ? trigger.tap() : trigger.click())
    for (let attempt = 0; attempt < 2; attempt++) {
      await clickTrigger()
      await expect(trigger).toHaveAttribute('data-expanded', 'true')
      await expect(panel).toBeVisible()
      await clickTrigger()
      await expect(trigger).toHaveAttribute('data-expanded', 'false')
      await expect(panel).toHaveCount(0)
    }
    await clickTrigger()
    await trigger.press('Escape')
    await expect(panel).toHaveCount(0)
    await trigger.press('Enter')
    await expect(panel).toBeVisible()
    const outsideY = page.viewportSize()!.height - 2
    if (isMobile) await page.touchscreen.tap(2, outsideY)
    else await page.mouse.click(2, outsideY)
    await expect(panel).toHaveCount(0)
  })
}

test('hover-open archive actions close when clicking their trigger', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByTestId('档案更多操作')
  const panel = page.locator('.archive-actions-menu')
  await trigger.hover()
  await expect(panel).toBeVisible()
  await trigger.click()
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
  await expect(panel).toHaveCount(0)
})

test('nested select closes independently and the parent trigger closes both menus', async ({
  page,
  isMobile,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const trigger = page.getByTestId('viewer-more-actions')
  const panel = page.locator('.viewer-actions-menu')
  const clickTrigger = () => (isMobile ? trigger.tap() : trigger.click())
  await clickTrigger()
  const select = panel.getByTestId('theme-switch')
  await select.click()
  await expect(page.locator('.w-select-popover:popover-open')).toHaveCount(1)
  await select.press('Escape')
  await expect(page.locator('.w-select-popover')).toHaveCount(0)
  await expect(panel).toBeVisible()
  await select.click()
  await clickTrigger()
  await expect(panel).toHaveCount(0)
  await expect(page.locator('.w-select-popover')).toHaveCount(0)
})

test('archive actions animate on entry and stay mounted through exit', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  const trigger = page.getByTestId('档案更多操作')
  const menu = page.locator('.archive-actions-menu')
  await expect(trigger).toBeEnabled()
  await expect(menu).toHaveCount(0)

  const transitions = await trigger.evaluate(async (element) => {
    if (!(element instanceof HTMLButtonElement)) return []
    element.click()
    await new Promise(requestAnimationFrame)
    const menu = document.querySelector('.archive-actions-menu')
    return menu
      ?.getAnimations()
      .map((animation) => (animation instanceof CSSTransition ? animation.transitionProperty : ''))
  })
  expect(transitions).toContain('opacity')
  await expect(menu).toBeVisible()
  await menu.evaluate((element) =>
    Promise.allSettled(element.getAnimations().map((animation) => animation.finished)),
  )
  await trigger.press('Escape')
  await expect(menu).toHaveAttribute('data-state', 'closing')
  await expect(menu).toHaveCount(0)
})

test('archive actions tolerate brief mouse passes and exits', async ({ page }) => {
  await page.goto('/')
  const trigger = page.getByTestId('档案更多操作')
  const menu = page.locator('.archive-actions-menu')
  await expect(trigger).toBeEnabled()
  await page.clock.install()
  await page.clock.pauseAt(Date.now() + 60_000)
  const box = (await trigger.boundingBox())!
  const hover = () => page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await hover()
  await page.clock.runFor(50)
  await expect(menu).toHaveCount(0)
  await page.mouse.move(0, 0)
  await page.clock.runFor(250)
  await expect(menu).toHaveCount(0)
  await hover()
  await page.clock.runFor(250)
  await expect(menu).toBeVisible()

  const download = page.getByTestId('export-achievement-file')
  const downloadBox = (await download.boundingBox())!
  const hoverDownload = () =>
    page.mouse.move(downloadBox.x + downloadBox.width / 2, downloadBox.y + downloadBox.height / 2)
  await hoverDownload()
  await page.mouse.move(0, 0)
  await page.clock.runFor(175)
  await expect(menu).toHaveAttribute('data-state', 'open')
  await hoverDownload()
  await page.clock.runFor(350)
  await expect(menu).toHaveAttribute('data-state', 'open')
  await page.mouse.move(0, 0)
  await page.clock.runFor(350)
  await expect(trigger).toHaveAttribute('data-expanded', 'false')
})
