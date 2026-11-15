import zh from './zh-CN.json' with { type: 'json' }
import zhTW from './zh-TW.json' with { type: 'json' }
import en from './en.json' with { type: 'json' }
import ja from './ja.json' with { type: 'json' }
import ko from './ko.json' with { type: 'json' }
import de from './de.json' with { type: 'json' }
import es from './es.json' with { type: 'json' }
import fr from './fr.json' with { type: 'json' }
import pt from './pt.json' with { type: 'json' }
import th from './th.json' with { type: 'json' }

export const translations = { 'zh-CN': zh, 'zh-TW': zhTW, en, ja, ko, de, es, fr, pt, th }
export type AppLanguage = keyof typeof translations
export const appLanguages = Object.keys(translations) as AppLanguage[]
export const isLanguage = (value: unknown): value is AppLanguage =>
  typeof value === 'string' && Object.hasOwn(translations, value)

// Language names are autonyms so the picker remains recognizable in every locale.
export const contentLanguageCodes: Record<AppLanguage, keyof typeof zh.contentLanguages> = {
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  de: 'de',
  es: 'es',
  fr: 'fr',
  pt: 'pt',
  th: 'th',
}
export const languageOptions = appLanguages.map((value) => ({
  value,
  label: zh.contentLanguages[contentLanguageCodes[value]],
}))
