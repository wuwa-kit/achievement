import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useDesktopStore } from '../stores/desktop'

import { WThemeSwitch } from '../components/ui/WThemeSwitch'
import { WLanguageSwitch } from '../components/ui/WLanguageSwitch'
import { WTooltip } from '../components/ui/WTooltip'
import { WIconButton, iconButtonClass } from '../components/ui/WIconButton'
import { WSvg } from '../components/ui/WSvg'
import { OpenSourceLink } from '../components/OpenSourceLink'
import { DesktopUpdate } from './DesktopUpdate'
import { DesktopZoom } from './DesktopZoom'
import { isDesktop } from './bridge'

export function DesktopToolbar() {
  const { t } = useTranslation()
  const { loaded, pending, state, exportLogs } = useDesktopStore(
    useShallow(({ loaded, pending, state, exportLogs }) => ({
      loaded,
      pending,
      state,
      exportLogs,
    })),
  )
  const disabled = !loaded || pending || state.busy
  return (
    <div className="desktop-header mb-2 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 text-[16px] wrap-anywhere">{t('desktop.game')}</div>
      <div className="desktop-tools flex min-w-0 flex-wrap items-center gap-2">
        <DesktopUpdate />
        <WTooltip text={t('desktop.exportLogs')}>
          <WIconButton
            data-testid="desktop-export-logs"
            disabled={disabled}
            onClick={() => void exportLogs()}
          >
            <WSvg name="file-export" size={20} />
          </WIconButton>
        </WTooltip>
        {isDesktop && <DesktopZoom />}
        <WThemeSwitch />
        <WLanguageSwitch />
        <WTooltip text={t('desktop.openWebsite')}>
          <a
            className={`${iconButtonClass} text-(--color-accent)`}
            href="https://wu.songe.li/"
            target="_blank"
            rel="noreferrer"
            data-testid="desktop-website"
            onClick={(event) => {
              if (event.detail > 0) event.currentTarget.blur()
            }}
          >
            <WSvg name="panels-top-left" size={20} />
          </a>
        </WTooltip>
        <OpenSourceLink />
      </div>
    </div>
  )
}
