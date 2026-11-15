import { expect, test } from '@playwright/test'

test('scrollbar thumb follows the scroll event without ScrollTimeline', async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'ScrollTimeline')
  })
  await page.goto('/')
  const list = page.getByTestId('成就列表')
  await expect(list.locator('.achievement-row').first()).toBeVisible()

  const positionError = await list.evaluate(
    (viewport) =>
      new Promise<number>((resolve) => {
        const track = viewport.querySelector('.os-scrollbar-vertical .os-scrollbar-track')!
        const thumb = track.querySelector('.os-scrollbar-handle')!
        const scrollRange = viewport.scrollHeight - viewport.clientHeight
        viewport.addEventListener(
          'scroll',
          () => {
            const trackRect = track.getBoundingClientRect()
            const thumbRect = thumb.getBoundingClientRect()
            const expectedOffset =
              (trackRect.height - thumbRect.height) * (viewport.scrollTop / scrollRange)
            resolve(Math.abs(thumbRect.top - trackRect.top - expectedOffset))
          },
          { once: true },
        )
        viewport.scrollTop = scrollRange / 2
      }),
  )
  expect(positionError).toBeLessThan(1)
})

test('custom scrollbar supports wheel, drag and dialog dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 })
  await page.goto('/')
  await expect(page.locator('.achievement-row').first()).toBeVisible()
  const list = page.getByTestId('成就列表')
  const scrollbar = list.locator(':scope > .os-scrollbar-vertical')
  await expect(scrollbar).toHaveCount(1)
  const scrollHeight = await list.evaluate((element) => element.scrollHeight)
  const expectEqualSlots = async () => {
    const heights = await list
      .locator('.achievement-list-item')
      .evaluateAll((slots) => slots.map((slot) => slot.getBoundingClientRect().height))
    expect(heights.length).toBeGreaterThan(1)
    expect(new Set(heights).size).toBe(1)
    const count = Number(await list.getAttribute('data-count'))
    expect(scrollHeight).toBe(count * heights[0])
  }
  await expectEqualSlots()
  await page.mouse.move(800, 350)
  await page.mouse.wheel(0, 450)
  const scrollTop = () => list.evaluate((element) => element.scrollTop)
  await expect.poll(scrollTop).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  const handle = scrollbar.locator('.os-scrollbar-handle')
  const beforeDrag = await scrollTop()
  const box = await handle.boundingBox()
  expect(box).not.toBeNull()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await page.mouse.down()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 70, { steps: 8 })
  await page.mouse.up()
  await expect.poll(scrollTop).toBeGreaterThan(beforeDrag)
  expect(await list.evaluate((element) => element.scrollHeight)).toBe(scrollHeight)
  await expectEqualSlots()
  const track = scrollbar.locator('.os-scrollbar-track')
  await expect
    .poll(async () => {
      const handleBox = (await handle.boundingBox())!
      const trackBox = (await track.boundingBox())!
      const ratio = await list.evaluate(
        (element) => element.scrollTop / (element.scrollHeight - element.clientHeight),
      )
      return Math.abs(handleBox.y - trackBox.y - ratio * (trackBox.height - handleBox.height))
    })
    .toBeLessThan(2)
  await list.evaluate((element) => {
    element.scrollTop = 0
  })
  await list
    .locator('[data-index="0"]')
    .getByTestId(/^查看成就详情 /)
    .click()
  const details = page.getByTestId('成就详情内容')
  await expect(details).toBeVisible()
  await page.setViewportSize({ width: 900, height: 250 })
  await details.hover()
  await page.mouse.wheel(0, 600)
  await expect.poll(() => details.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await details.evaluate((element) => getComputedStyle(element).scrollbarWidth)).toBe('none')
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).toHaveCount(0)
})
