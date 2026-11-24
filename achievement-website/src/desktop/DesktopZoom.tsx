import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WButton } from '../components/ui/WButton'
import { WIconButton } from '../components/ui/WIconButton'
import { WPopover } from '../components/ui/WPopover'
import { WSvg } from '../components/ui/WSvg'
import { WTooltip } from '../components/ui/WTooltip'
import { useDesktopStore } from '../stores/desktop'

export function DesktopZoom() {
  const { t } = useTranslation()
  const zoom = useDesktopStore((state) => state.zoom)
  const adjust = useDesktopStore((state) => state.adjustZoom)
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <>
      <WTooltip text={t('desktop.zoom.label') + ' · ' + zoom + '%'}>
        <WIconButton
          ref={anchor}
          data-testid="desktop-zoom"
          data-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <WSvg name="zoom-in" size={20} />
        </WIconButton>
      </WTooltip>
      <WPopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchor}
        placement="bottom-end"
        className="flex items-center gap-2 [--popover-padding:8px_12px]"
      >
        <WTooltip text={t('desktop.zoom.out')}>
          <WIconButton
            variant="ghost"
            data-testid="zoom-out"
            disabled={zoom <= 25}
            onClick={() => void adjust('out')}
          >
            <WSvg name="minus" size={18} />
          </WIconButton>
        </WTooltip>
        <WTooltip text={t('desktop.zoom.reset')}>
          <WButton
            className="h-9 w-16 shrink-0 rounded-md bg-(--color-surface-soft) text-center text-sm font-medium tabular-nums enabled:hover:bg-(--color-surface-hover)"
            onClick={() => void adjust('reset')}
          >
            {zoom}%
          </WButton>
        </WTooltip>
        <WTooltip text={t('desktop.zoom.in')}>
          <WIconButton
            variant="ghost"
            data-testid="zoom-in"
            disabled={zoom >= 500}
            onClick={() => void adjust('in')}
          >
            <WSvg name="plus" size={18} />
          </WIconButton>
        </WTooltip>
      </WPopover>
    </>
  )
}
