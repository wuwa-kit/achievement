import { expect, test } from '@playwright/test'
import { selectValue } from './select-helpers'
import {
  appLanguages,
  languageOptions,
  translations,
  contentLanguageCodes,
} from '../src/i18n/resources'
import { readFileSync } from 'node:fs'
const catalog = JSON.parse(
  readFileSync(new URL('../../data/achievement-catalog.json', import.meta.url), 'utf8'),
)

for (const { route, locales, expected } of [
  { route: '/', locales: ['ja-JP', 'en-US'], expected: 'ja' },
  { route: '/desktop', locales: ['ru-RU', 'zh-HK'], expected: 'zh-TW' },
  { route: '/', locales: ['zh-Hans-HK'], expected: 'zh-CN' },
  { route: '/', locales: ['ru-RU', 'vi-VN'], expected: 'en' },
]) {
  test(`detects ${locales.join(', ')} as ${expected} on ${route}`, async ({ page }) => {
    await page.addInitScript((languages) => {
      Object.defineProperty(navigator, 'languages', { value: languages })
    }, locales)
    await page.goto(route)
    await expect(page.locator('html')).toHaveAttribute('lang', expected)
    await expect(page.locator('.w-language-switch')).toBeVisible()

    await selectValue(page, page.locator('.w-language-switch'), 'ko')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'ko')
  })
}

for (const route of ['/', '/desktop']) {
  test(`shared language persists and translates UI on ${route}`, async ({
    page,
    context,
  }, testInfo) => {
    await page.goto(route)
    await expect(page.locator(route === '/' ? '.app-shell' : '.desktop-page')).toBeVisible()
    await selectValue(page, page.locator('.w-language-switch'), 'en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page).toHaveTitle(
      route === '/'
        ? 'Wuthering Waves · Achievement Archive'
        : 'Wuthering Waves · Achievement Export',
    )
    if (route === '/') {
      await expect(page.locator('.hide-completed')).toHaveText('Incomplete only')
      await expect(page.locator('.topbar-actions > .open-source-link:last-child')).toBeVisible()
      const openSourceLink = page.locator('.topbar-actions .open-source-link')
      await expect(openSourceLink).toHaveAttribute(
        'href',
        'https://github.com/wuwa-kit/achievement',
      )
      await openSourceLink.focus()
      await expect(page.locator('.w-tooltip')).toHaveText('Open source')
      await openSourceLink.press('Escape')
      await expect(page.locator('.w-tooltip')).toHaveCount(0)
      await page.getByTestId('import-achievement-file').hover()
      await expect(page.locator('.w-tooltip')).toHaveText('Import achievement file')
      await page.getByTestId('搜索成就').fill('100101')
      await expect(page.getByTestId('文本语言')).toHaveCount(0)
      await expect(page.locator('.achievement-title')).toHaveText(['POWER!'])
    } else {
      await expect(page.getByTestId('Game path')).toHaveAttribute(
        'placeholder',
        'Select Wuthering Waves.exe',
      )
      await expect(page.getByText('History', { exact: true })).toBeVisible()
      await page.getByTestId('Start capture').click()
      await expect(page.locator('.w-message')).toContainText('requires the desktop client')
      await page.locator('.w-message-close').click()
      await expect(page.locator('.w-message-host')).toHaveCount(0)
    }
    await page.getByTestId('theme-switch').click()
    await expect(page.locator('.w-select-option')).toHaveText(['Automatic', 'Light', 'Dark'])
    await page.getByTestId('theme-switch').press('Escape')
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true)
    await page.screenshot({ path: testInfo.outputPath('english.png') })
    const other = await context.newPage()
    await other.goto(route === '/' ? '/desktop' : '/')
    await expect(other.locator(route === '/' ? '.desktop-page' : '.app-shell')).toBeVisible()
    await expect(other.locator('html')).toHaveAttribute('lang', 'en')
    await selectValue(other, other.locator('.w-language-switch'), 'zh-CN')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    if (route === '/') {
      await expect(page.locator('.hide-completed')).toHaveText('只看未完成')
      await expect(page.getByTestId('搜索成就')).toHaveValue('100101')
      await expect(page.locator('.achievement-title')).toContainText(['抛瓦'])
    }
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await selectValue(page, page.locator('.w-language-switch'), 'en')
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await other.close()
  })
}

for (const route of ['/', '/desktop']) {
  test(`all ten UI languages translate and persist on ${route}`, async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(90000)
    await page.goto(route)
    await expect(page.locator(route === '/' ? '.app-shell' : '.desktop-page')).toBeVisible()
    const other = await context.newPage()
    await other.goto(route === '/' ? '/desktop' : '/')
    await expect(other.locator(route === '/' ? '.desktop-page' : '.app-shell')).toBeVisible()
    const picker = page.locator('.w-language-switch')
    await picker.click()
    await expect(page.locator('.w-select-option')).toHaveText(
      languageOptions.map((option) => option.label),
    )
    await picker.press('Escape')
    await expect(page.locator('.w-select-popover')).toHaveCount(0)
    for (const language of appLanguages) {
      const resource = translations[language]
      await selectValue(page, picker, language)
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(other.locator('html')).toHaveAttribute('lang', language)
      await expect(page).toHaveTitle(
        route === '/' ? resource.ui.appTitle : resource.common.desktopTitle,
      )
      if (route === '/') {
        await expect(page.locator('.hide-completed')).toHaveText(resource.ui.hideCompleted)
        await page.getByTestId('搜索成就').fill('100101')
        const text = catalog.achievements.find((item: { id: number }) => item.id === 100101).texts[
          contentLanguageCodes[language]
        ]
        await expect(page.locator('.achievement-row')).toHaveCount(1)
        await expect(page.locator('.achievement-title')).toHaveText(text.title)
        await page.getByTestId('查看成就详情 100101').click()
        await expect(page.locator('#detail-title')).toHaveText(text.title)
        const searchLink = page.getByTestId('search-achievement-online')
        const isChinese = language === 'zh-CN' || language === 'zh-TW'
        const searchUrl = isChinese
          ? 'https://search.bilibili.com/all?keyword=%E9%B8%A3%E6%BD%AE+%E6%8A%9B%E7%93%A6%EF%BC%81'
          : `https://www.google.com/search?${new URLSearchParams({ q: `Wuthering Waves ${text.title}` })}`
        await expect(searchLink).toHaveAttribute('target', '_blank')
        await expect(searchLink).toHaveAttribute('href', searchUrl)
        if (language === 'zh-CN' || language === 'ja') {
          await page.bringToFront()
          const closeButton = page.getByTestId('关闭详情')
          const searchTooltip = page.locator('.w-tooltip')
          const tooltipText = resource.ui.searchAchievementOn.replace(
            '{{site}}',
            isChinese ? '哔哩哔哩' : 'Google',
          )
          await expect(closeButton).toBeFocused()
          await searchLink.hover()
          await expect(searchTooltip).toHaveText(tooltipText)
          await closeButton.hover()
          await expect(searchTooltip).toHaveCount(0)
          await closeButton.press('Tab')
          await expect(searchLink).toBeFocused()
          await expect(searchTooltip).toHaveText(tooltipText)
          const matchesSearch = (url: URL) => url.href === searchUrl
          await context.route(matchesSearch, (route) => route.fulfill({ body: 'Search results' }))
          const [popup] = await Promise.all([page.waitForEvent('popup'), searchLink.click()])
          await expect(popup).toHaveURL(searchUrl)
          await popup.close()
          await context.unroute(matchesSearch)
          await expect(page.locator('#detail-title')).toBeVisible()
        }
        await page.getByTestId('关闭详情').click()
        await expect(page.locator('.w-dialog')).toHaveCount(0)
        await expect(page.getByTestId('搜索成就')).toHaveAttribute(
          'placeholder',
          resource.ui.search,
        )
      } else {
        await expect(page.locator('#game-path')).toHaveAttribute(
          'placeholder',
          resource.desktop.gamePlaceholder,
        )
        await page.getByTestId(resource.desktop.start).click()
        await expect(page.locator('.w-message')).toContainText(resource.common.previewOnly)
        await page.locator('.w-message-close').click()
        await expect(page.locator('.w-message-host')).toHaveCount(0)
      }
      await page.getByTestId('theme-switch').click()
      await expect(page.locator('.w-select-option')).toHaveText([
        resource.common.auto,
        resource.common.light,
        resource.common.dark,
      ])
      await page.getByTestId('theme-switch').press('Escape')
      await expect(page.locator('.w-select-popover')).toHaveCount(0)
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true)
      if (['de', 'ja', 'th'].includes(language))
        await page.screenshot({ path: testInfo.outputPath(`${language}.png`) })
      await page.reload()
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page).toHaveTitle(
        route === '/' ? resource.ui.appTitle : resource.common.desktopTitle,
      )
    }
    await other.close()
  })
}
