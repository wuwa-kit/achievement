import { expect, test } from '@playwright/test'
import { selectValue } from './select-helpers'
import { appLanguages } from '../src/i18n/resources'
test('desktop settings override browser caches and preference writes exclude business drafts', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('wuwa-language', 'zh-CN')
    localStorage.setItem('wuwa-theme', 'light')
    let listener: (event: { data: unknown }) => void
    let settings = {
      gamePath: 'C:/Saved/Game.exe',
      language: 'en',
      theme: 'dark',
    }
    Object.defineProperty(window, 'chrome', {
      configurable: true,
      value: {
        webview: {
          addEventListener: (_: string, callback: typeof listener) => {
            listener = callback
          },
          postMessage(message: {
            id: string
            method: string
            params: { language: string; theme: string }
          }) {
            let result: unknown = null
            let error: string | undefined
            if (message.method === 'settings.get') result = settings
            if (message.method === 'state.get')
              result = { stage: 'ready', busy: false, transferUrl: null, error: null }
            if (message.method === 'preferences.save') {
              sessionStorage.setItem('preference-payload', JSON.stringify(message.params))
              if (sessionStorage.getItem('fail-preferences')) error = 'Save failed'
              else {
                settings = { ...settings, ...message.params }
                result = settings
              }
            }
            queueMicrotask(() => listener({ data: { id: message.id, result, error } }))
          },
        },
      },
    })
  })
  await page.goto('/desktop')
  await expect(page.getByTestId('Game path')).toHaveValue('C:/Saved/Game.exe')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('preference-payload')))
    .toBeNull()
  await page.getByTestId('Game path').fill('D:/Unsaved/Game.exe')
  await selectValue(page, page.getByTestId('theme-switch'), 'light')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('preference-payload')))
    .toBe(JSON.stringify({ language: 'en', theme: 'light' }))
  await selectValue(page, page.locator('.w-language-switch'), 'zh-CN')
  await expect(page.getByTestId('游戏路径')).toHaveValue('D:/Unsaved/Game.exe')
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('preference-payload')))
    .toBe(JSON.stringify({ language: 'zh-CN', theme: 'light' }))
  expect(await page.evaluate(() => localStorage.getItem('wuwa-language'))).toBe('zh-CN')
  for (const language of appLanguages) {
    await selectValue(page, page.locator('.w-language-switch'), language)
    await expect(page.locator('html')).toHaveAttribute('lang', language)
    await expect
      .poll(() => page.evaluate(() => sessionStorage.getItem('preference-payload')))
      .toBe(JSON.stringify({ language, theme: 'light' }))
    await expect(page.locator('#game-path')).toHaveValue('D:/Unsaved/Game.exe')
  }
  await page.evaluate(() => sessionStorage.setItem('fail-preferences', '1'))
  await selectValue(page, page.getByTestId('theme-switch'), 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('.w-message')).toContainText('Save failed')
})
