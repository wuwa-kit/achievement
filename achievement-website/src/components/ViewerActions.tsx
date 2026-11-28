import { useState } from 'react'
import { useResponsive } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { WIconButton } from './ui/WIconButton'
import { WPopover } from './ui/WPopover'
import { usePopoverTrigger } from './ui/usePopoverTrigger'
import { WScrollArea } from './ui/WScrollArea'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'
import { WLanguageSwitch } from './ui/WLanguageSwitch'
import { WThemeSwitch } from './ui/WThemeSwitch'
import { OpenSourceLink } from './OpenSourceLink'
import { ExportToolIntro } from './ExportToolIntro'

export function ViewerActions() {
  const { t } = useTranslation()
  const compact = !useResponsive().md
  const [expanded, setExpanded] = useState(false)
  const { anchorRef, triggerProps, popoverProps } = usePopoverTrigger(expanded, setExpanded)

  return (
    <div className="topbar-actions flex flex-none items-center gap-2 max-md:gap-1">
      <ExportToolIntro />
      {compact ? (
        <div
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return
            setExpanded(false)
            anchorRef.current?.focus()
          }}
        >
          <WTooltip text={t('ui.moreActions')}>
            <WIconButton
              {...triggerProps}
              className="size-11 text-(--color-accent)"
              data-testid="viewer-more-actions"
            >
              <WSvg name="ellipsis" size={20} />
            </WIconButton>
          </WTooltip>
          <WPopover
            {...popoverProps}
            className="viewer-actions-menu"
            placement="bottom-end"
            offset={4}
          >
            <WScrollArea className="max-h-[var(--w-popover-height)] w-[280px] space-y-1 overflow-auto p-2">
              <WThemeSwitch showLabel />
              <WLanguageSwitch showLabel />
              <OpenSourceLink showLabel />
            </WScrollArea>
          </WPopover>
        </div>
      ) : (
        <>
          <WThemeSwitch />
          <WLanguageSwitch />
          <OpenSourceLink />
        </>
      )}
    </div>
  )
}
