import { expect, test } from '@playwright/test'
import { revealArchiveActions, revealToolbarActions, selectValue } from './select-helpers'
import { appLanguages } from '../src/i18n/resources'

test('export introduction opens, links to the video and download, and closes', async ({
  page,
  context,
}, testInfo) => {
  await context.route('https://www.bilibili.com/video/BV1p8sW6TEPJ/', (route) =>
    route.fulfill({ body: 'Video introduction' }),
  )
  await context.route('https://github.com/wuwa-kit/achievement/releases/latest', (route) =>
    route.fulfill({ body: 'Downloads' }),
  )
  await page.goto('/')
  const trigger = page.getByTestId('export-tool-intro')
  const dialog = page.getByTestId('export-tool-dialog')
  await expect(dialog).toHaveCount(0)
  await trigger.click()
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('成就导出工具介绍')
  await expect(dialog).toContainText('Windows')
  await expect(page.getByTestId('export-tool-video')).toHaveText('观看介绍视频')
  await page.getByTestId('export-tool-download').click()
  const downloads = page.getByTestId('export-tool-download-dialog')
  await expect(downloads.locator('a')).toHaveCount(3)
  await expect(downloads).toContainText('提取码：w88p')
  const [release] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByTestId('export-tool-download-github').click(),
  ])
  await expect(release).toHaveURL('https://github.com/wuwa-kit/achievement/releases/latest')
  await release.close()
  await page.screenshot({
    path: testInfo.outputPath('download-sources.png'),
    animations: 'disabled',
  })
  await page.getByTestId('close-export-tool-download-dialog').click()
  await expect(downloads).toHaveCount(0)
  await expect(dialog).toBeVisible()
  const [video] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByTestId('export-tool-video').click(),
  ])
  await expect(video).toHaveURL('https://www.bilibili.com/video/BV1p8sW6TEPJ/')
  await video.close()
  await page.screenshot({
    path: testInfo.outputPath('export-introduction.png'),
    animations: 'disabled',
  })
  await page.getByTestId('close-export-tool-dialog').click()
  await expect(dialog).toHaveCount(0)
  await trigger.focus()
  await trigger.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await trigger.click()
  await page.mouse.click(2, 2)
  await expect(dialog).toHaveCount(0)
})

for (const language of appLanguages) {
  test(`download sources follow the ${language} UI language`, async ({ page }) => {
    await page.addInitScript(
      (language) => localStorage.setItem('wuwa-language', language),
      language,
    )
    await page.goto('/')
    await page.getByTestId('export-tool-intro').click()
    await expect(page.getByTestId('export-tool-video')).not.toContainText(/Bilibili|B 站/)
    await page.getByTestId('export-tool-download').click()
    const downloads = page.getByTestId('export-tool-download-dialog')
    const chinese = language === 'zh-CN' || language === 'zh-TW'
    await expect(downloads.locator('a')).toHaveCount(chinese ? 3 : 1)
    await expect(page.getByTestId('export-tool-download-github')).toHaveAttribute(
      'href',
      'https://github.com/wuwa-kit/achievement/releases/latest',
    )
    if (chinese) {
      await expect(page.getByTestId('export-tool-download-quark')).toHaveAttribute(
        'href',
        'https://pan.quark.cn/s/2174c2b68b2c',
      )
      await expect(page.getByTestId('export-tool-download-baidu')).toHaveAttribute(
        'href',
        'https://pan.baidu.com/s/1gGEZLyB4nThy8zWKj4DIyw?pwd=w88p',
      )
    }
    await page.keyboard.press('Escape')
    await expect(downloads).toHaveCount(0)
    await expect(page.getByTestId('export-tool-dialog')).toBeVisible()
  })
}

test('compact toolbar groups actions and keeps settings usable in the nested menu', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto('/')
  await expect(page.getByTestId('账号档案')).toBeVisible()
  await expect(page.getByTestId('import-achievement-file')).toHaveCount(0)
  await expect(page.locator('.topbar-records').getByTestId('档案更多操作')).toBeVisible()
  await expect(page.locator('.topbar-actions').getByTestId('档案更多操作')).toHaveCount(0)
  await expect(page.getByTestId('export-tool-intro')).toBeVisible()
  await expect(page.locator('.w-language-switch')).toHaveCount(0)
  await expect(page.locator('.topbar-actions > button')).toHaveCount(1)
  await revealArchiveActions(page)
  await expect(page.getByTestId('import-achievement-file')).toHaveText('导入成就文件')
  await expect(page.getByTestId('export-achievement-file')).toHaveText('导出成就文件')
  await expect(page.getByTestId('删除档案')).toHaveText('删除档案')
  await expect(page.locator('.archive-actions-menu .w-language-switch')).toHaveCount(0)
  const chooser = page.waitForEvent('filechooser')
  await page.getByTestId('import-achievement-file').click()
  await (await chooser).setFiles([])
  await expect(page.locator('.archive-actions-menu')).toHaveCount(0)
  await revealToolbarActions(page)
  await expect(
    page.locator('.viewer-actions-menu').getByTestId('export-achievement-file'),
  ).toHaveCount(0)
  await expect(page.locator('.viewer-actions-menu').getByTestId('删除档案')).toHaveCount(0)
  await expect(page.locator('.open-source-link')).toHaveText('开放源代码')
  await selectValue(page, page.getByTestId('theme-switch'), 'dark')
  await expect(page.locator('.viewer-actions-menu')).toBeVisible()
  await selectValue(page, page.locator('.w-language-switch'), 'en')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('.viewer-actions-menu')).toContainText('Theme')
  await page.locator('.viewer-actions-menu').hover({ position: { x: 2, y: 2 } })
  await expect(page.locator('.w-tooltip')).toHaveCount(0)
  await page.screenshot({
    path: testInfo.outputPath('mobile-more-actions.png'),
    animations: 'disabled',
  })
  await page.getByTestId('theme-switch').click()
  await page.getByTestId('theme-switch').press('Escape')
  await expect(page.locator('.w-select-popover')).toHaveCount(0)
  await expect(page.locator('.viewer-actions-menu')).toBeVisible()
  await page.getByTestId('theme-switch').press('Escape')
  await expect(page.locator('.viewer-actions-menu')).toHaveCount(0)
  await page.getByTestId('export-tool-intro').click()
  await expect(page.getByTestId('export-tool-dialog')).toContainText('Achievement export tool')
  await page.screenshot({
    path: testInfo.outputPath('mobile-dark-introduction.png'),
    animations: 'disabled',
  })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('export-tool-dialog')).toHaveCount(0)

  for (const width of [320, 390, 600, 767, 768, 900, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    await expect(page.locator('.w-language-switch')).toHaveCount(width < 768 ? 0 : 1)
    await expect(page.locator('.topbar-records').getByTestId('档案更多操作')).toBeVisible()
    if (width >= 768) {
      await expect(
        page.locator('.topbar-records').getByTestId('import-achievement-file'),
      ).toBeVisible()
    }
    const controls = page.locator('.topbar button:visible, .topbar a:visible')
    const bounds = await controls.evaluateAll((elements) =>
      elements.map((element) => {
        const { left, right, width } = element.getBoundingClientRect()
        return { left, right, width }
      }),
    )
    expect(
      bounds.every((box) => box.left >= 0 && box.right <= width && box.width > 0),
      JSON.stringify({ width, bounds }),
    ).toBe(true)
    expect(
      await page
        .locator('.topbar')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
  }
})
