import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { desktopBootstrap } from '../lib/bootstrap.ts'
import { translations, appLanguages, isLanguage, type AppLanguage } from './resources.ts'
export { appLanguages, isLanguage, languageOptions, type AppLanguage } from './resources.ts'
export const languageKey = 'wuwa-language'
let language: AppLanguage = isLanguage(desktopBootstrap?.language)
  ? desktopBootstrap.language
  : 'zh-CN'
try {
  const saved =
    typeof window === 'undefined' || window.chrome?.webview
      ? null
      : localStorage.getItem(languageKey)
  if (isLanguage(saved)) language = saved
} catch {
  /* Browser storage is optional. */
}
void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    appLanguages.map((code) => [code, { translation: translations[code] }]),
  ),
  lng: language,
  fallbackLng: 'zh-CN',
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
