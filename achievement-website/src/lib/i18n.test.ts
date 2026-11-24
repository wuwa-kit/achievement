import { test } from 'node:test'
import assert from 'node:assert/strict'
import { translations, appLanguages, isLanguage, languageOptions } from '../i18n/resources.ts'
import { createInstance } from 'i18next'
import { readdirSync } from 'node:fs'
function keys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value)
    .flatMap(([key, entry]) =>
      typeof entry === 'object' && entry !== null
        ? keys(entry as Record<string, unknown>, prefix + key + '.')
        : [prefix + key],
    )
    .sort()
}
test('registered UI languages match the ten game languages and bundled locale files', () => {
  assert.deepEqual(appLanguages, ['zh-CN', 'zh-TW', 'en', 'ja', 'ko', 'de', 'es', 'fr', 'pt', 'th'])
  assert.deepEqual(
    readdirSync(new URL('../i18n/', import.meta.url))
      .filter((name) => name.endsWith('.json'))
      .sort(),
    appLanguages.map((code) => `${code}.json`).sort(),
  )
  assert.deepEqual(
    languageOptions.map((option) => option.value),
    appLanguages,
  )
  for (const value of [...appLanguages, 'id', 'ru', 'vi', 'toString', '__proto__', null]) {
    assert.equal(isLanguage(value), appLanguages.includes(value as (typeof appLanguages)[number]))
  }
})

for (const language of appLanguages)
  test(`${language} covers every key and preserves interpolation and file filters`, async () => {
    const zh = translations['zh-CN']
    const locale = translations[language]
    assert.deepEqual(keys(zh), keys(locale))
    const instance = createInstance()
    await instance.init({
      lng: language,
      fallbackLng: false,
      resources: { [language]: { translation: locale } },
    })
    for (const key of keys(zh)) {
      const read = (root: object) =>
        key
          .split('.')
          .reduce((v, k) => (v as Record<string, unknown>)[k], root as unknown) as string
      const a = read(zh),
        b = read(locale)
      assert.ok(a.trim() && b.trim(), key)
      assert.deepEqual(
        a.match(/\{\{[^}]+\}\}/g)?.sort() ?? [],
        b.match(/\{\{[^}]+\}\}/g)?.sort() ?? [],
        key,
      )
      assert.ok(instance.exists(key), `${language}.${key}`)
      const rendered = instance.t(key, {
        count: 2,
        value0: 'VALUE',
        groups: 7,
        entries: 14,
        reason: 'REASON',
        time: 'TIME',
        astrite: 10,
        from: 1,
        to: 2,
        current: 1,
        total: 3,
        percent: 50,
        version: 'VERSION',
        edition: 'EDITION',
        id: 100,
        uid: '10001',
        incoming: '2020-01-01',
        existing: '2020-01-02',
        tier: 'HD',
        stage: 'STAGE',
        code: 'CODE',
        field: 'FIELD',
        attempts: 8,
        site: 'SITE',
      })
      assert.ok(!rendered.includes('{{'), `${language}.${key}: interpolation failed`)
    }
    for (const key of ['jsonFilter', 'gameFilter'] as const) {
      assert.equal(locale.native[key].split('|')[1], zh.native[key].split('|')[1])
    }
  })
