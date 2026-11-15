import { create } from 'zustand'
import i18n, { browserLanguage, isLanguage, languageKey, type AppLanguage } from '../i18n'
import { defaultLanguage } from '../i18n/resources'
import { isDesktop } from '../lib/environment'
import { desktopBootstrap } from '../lib/bootstrap'
import { wMessage } from './message'
export type ThemeMode = 'auto' | 'light' | 'dark'
const isTheme = (value: unknown): value is ThemeMode =>
  value === 'auto' || value === 'light' || value === 'dark'
const media = matchMedia('(prefers-color-scheme: dark)')
interface Preferences {
  language: AppLanguage
  mode: ThemeMode
}
interface PreferenceStore extends Preferences {
  ready: boolean
  initialize(): Promise<void>
  setLanguage(language: AppLanguage): void
  setMode(mode: ThemeMode): void
}
let initialization: Promise<void> | undefined
let writes = Promise.resolve()
let revision = 0
let persisted: Preferences = {
  language: isLanguage(i18n.language) ? i18n.language : defaultLanguage,
  mode: isTheme(desktopBootstrap?.theme)
    ? desktopBootstrap.theme
    : isTheme(document.documentElement.dataset.themeMode)
      ? document.documentElement.dataset.themeMode
      : 'auto',
}
function save(next: Preferences) {
  const version = ++revision
  if (!isDesktop) {
    try {
      localStorage.setItem(languageKey, next.language)
      localStorage.setItem('wuwa-theme', next.mode)
    } catch {
      /* Storage may be unavailable. */
    }
    persisted = next
    return
  }
  writes = writes.then(async () => {
    try {
      await (
        await import('../desktop/bridge')
      ).request('preferences.save', { language: next.language, theme: next.mode })
      persisted = next
    } catch (error) {
      if (version === revision) usePreferencesStore.setState(persisted)
      wMessage.error(error instanceof Error ? error.message : String(error))
    }
  })
}
export const usePreferencesStore = create<PreferenceStore>((set, get) => ({
  ...persisted,
  ready: !isDesktop || !!desktopBootstrap,
  initialize() {
    return (initialization ??= (async () => {
      if (isDesktop && !desktopBootstrap) {
        try {
          const { getInitialDesktopSettings } = await import('../desktop/bridge')
          const settings = await getInitialDesktopSettings()
          persisted = {
            language: isLanguage(settings.language) ? settings.language : defaultLanguage,
            mode: isTheme(settings.theme) ? settings.theme : 'auto',
          }
          set({ ...persisted, ready: true })
        } catch (error) {
          // Allow the page to show its connection error, without writing defaults to the host.
          wMessage.error(String(error))
        }
      }
    })())
  },
  setLanguage(language) {
    if (!isLanguage(language) || !get().ready) return
    set({ language })
    save({ language, mode: get().mode })
  },
  setMode(mode) {
    if (!isTheme(mode) || !get().ready) return
    set({ mode })
    save({ mode, language: get().language })
  },
}))
function apply() {
  const { language, mode } = usePreferencesStore.getState()
  void i18n.changeLanguage(language)
  const dark = mode === 'dark' || (mode === 'auto' && media.matches)
  const root = document.documentElement
  root.lang = language
  root.dataset.themeMode = mode
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  root.style.backgroundColor = dark ? '#111521' : '#eef0f5'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', root.style.backgroundColor)
  window.dispatchEvent(new Event('wuwa-theme-change'))
  if (isDesktop && usePreferencesStore.getState().ready)
    void import('../desktop/bridge')
      .then(({ request }) => request('theme.set', { dark }))
      .catch(console.error)
}
const unsubscribe = usePreferencesStore.subscribe(apply)
const onSystemChange = () => {
  if (usePreferencesStore.getState().mode === 'auto') apply()
}
const onStorage = (event: StorageEvent) => {
  if (isDesktop) return
  if (event.key === languageKey || event.key === null)
    usePreferencesStore.setState({
      language: isLanguage(event.newValue) ? event.newValue : browserLanguage(),
    })
  if (event.key === 'wuwa-theme' || event.key === null)
    usePreferencesStore.setState({ mode: isTheme(event.newValue) ? event.newValue : 'auto' })
}
media.addEventListener('change', onSystemChange)
window.addEventListener('storage', onStorage)
apply()
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    unsubscribe()
    media.removeEventListener('change', onSystemChange)
    window.removeEventListener('storage', onStorage)
  })
