import type { DesktopSettings, DesktopState, Methods, Message, ResourceTier } from './bridge'
import { defaultLanguage } from '../i18n/resources'
import { tr } from '../i18n'

type Handlers = {
  [K in keyof Methods]?: (params: Methods[K]['params']) => Methods[K]['result']
}

export function createMockHost(emit: (message: Message) => void, overrides: Handlers = {}) {
  const gamePath = 'C:/WeGameApps/rail_apps/Wuthering Waves(2002137)/Wuthering Waves.exe'
  let settings: DesktopSettings = { gamePath, language: defaultLanguage, quality: 'auto' }
  let state: DesktopState = { stage: 'ready', busy: false, transferUrl: null, error: null }
  let zoom = 100
  const tiers: ResourceTier[] = ['hd', 'uhd']
  function setStage(stage: DesktopState['stage'], busy: boolean) {
    state = { ...state, stage, busy }
    emit({ event: 'state', data: state })
  }
  const handlers: Handlers = {
    'settings.get': () => settings,
    'settings.save': (next) => (settings = { ...next }),
    'state.get': () => state,
    'game.choose': () => gamePath,
    'game.detect': () => gamePath,
    'game.quality': (params) =>
      params.gamePath.trim() === gamePath ? { selected: 'hd', localTiers: tiers } : null,
    'export.start': () => {
      if (
        (!settings.quality || settings.quality === 'auto') &&
        settings.gamePath.trim() !== gamePath
      )
        return 'qualityRequired'
      setStage('login', true)
      return settings.quality === 'auto' ? 'hd' : null
    },
    'export.cancel': () => {
      setStage('cancelled', false)
      return null
    },
    'zoom.get': () => zoom,
    'zoom.adjust': ({ direction }) => {
      zoom =
        direction === 'reset'
          ? 100
          : Math.max(25, Math.min(500, zoom + (direction === 'in' ? 10 : -10)))
      emit({ event: 'zoom', data: zoom })
      return zoom
    },
    'update.check': () => ({
      status: 'checked',
      currentVersion: '0.1.5',
      currentEdition: 'lite',
      release: null,
    }),
    ...overrides,
  }
  return <K extends keyof Methods>(
    method: K,
    params?: Methods[K]['params'],
  ): Methods[K]['result'] => {
    const handler = handlers[method] as
      ((params?: Methods[K]['params']) => Methods[K]['result']) | undefined
    if (!handler) throw new Error(tr('common.previewOnly'))
    return handler(params)
  }
}
