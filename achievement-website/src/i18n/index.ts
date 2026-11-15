import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { desktopBootstrap } from '../lib/bootstrap.ts'
import {
  translations,
  appLanguages,
  defaultLanguage,
  detectLanguage,
  isLanguage,
} from './resources.ts'
export { appLanguages, isLanguage, languageOptions, type AppLanguage } from './resources.ts'
export const languageKey = 'wuwa-language'

export function browserLanguage() {
  const { languages, language } = window.navigator
  return detectLanguage(languages?.length ? languages : [language])
}

function initialLanguage() {
  if (typeof window === 'undefined') return defaultLanguage
  if (window.chrome?.webview)
    return isLanguage(desktopBootstrap?.language) ? desktopBootstrap.language : defaultLanguage
  try {
    const saved = localStorage.getItem(languageKey)
    if (isLanguage(saved)) return saved
  } catch {
    /* Browser storage is optional. */
  }
  return browserLanguage()
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    appLanguages.map((code) => [code, { translation: translations[code] }]),
  ),
  lng: initialLanguage(),
  fallbackLng: defaultLanguage,
  supportedLngs: appLanguages,
  load: 'currentOnly',
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})
export default i18n
export const tr = (key: string, values?: Record<string, unknown>): string =>
  i18n.t(key, values ?? {})
export const formatDate = (value: string) =>
  new Date(value).toLocaleString(i18n.language, { hour12: false })
