import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { achievementVersions } from '../lib/achievement-versions'
import { WButton } from './ui/WButton'
import { WCheckBox } from './ui/WCheckBox'
import { WEllipsis } from './ui/WEllipsis'
import { WPopover } from './ui/WPopover'
import { WScrollArea } from './ui/WScrollArea'
import { selectTriggerClass } from './ui/WSelect'
import { WSvg } from './ui/WSvg'

export function AchievementVersionFilter({
  versions,
  onVersionsChange,
}: {
  versions: readonly string[]
  onVersionsChange: (versions: string[]) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const selected = new Set(versions)
  const allVersions = t('ui.allVersions')

  function handleVersionChange(version: string, checked: boolean) {
    onVersionsChange(
      achievementVersions.filter((option) => (option === version ? checked : selected.has(option))),
    )
  }

  return (
    <>
      <WButton
        ref={anchorRef}
        className={`group w-[clamp(100px,29vw,138px)] flex-none ${selectTriggerClass}`}
        data-testid="版本筛选"
        data-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <WEllipsis className="group-data-[expanded=true]:pointer-events-none">
          {versions.join(', ') || allVersions}
        </WEllipsis>
        <WSvg
          name="chevron-down"
          className="shrink-0 group-data-[expanded=true]:rotate-180 motion-safe:transition-transform"
          size={14}
        />
      </WButton>
      <WPopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={anchorRef}
        placement="bottom-end"
        matchTriggerWidth
        data-testid="版本筛选弹层"
      >
        <div className="flex max-h-[min(280px,calc(var(--w-popover-height,280px)-2px))] flex-col p-1">
          <WButton
            className="shrink-0 rounded-sm px-3 py-1.5 text-start text-[14px] leading-5 wrap-anywhere hover:bg-(--color-surface-hover) data-[selected=true]:bg-(--color-selection)"
            data-selected={versions.length === 0}
            onClick={() => onVersionsChange([])}
          >
            {allVersions}
          </WButton>
          <WScrollArea className="mt-1 min-h-0 overflow-auto border-t border-(--color-border) pt-1">
            {achievementVersions.map((version) => (
              <WCheckBox
                key={version}
                className="w-full leading-5 [--checkbox-px:12px] [--checkbox-text:14px]"
                data-version={version}
                checked={selected.has(version)}
                onCheckedChange={(checked) => handleVersionChange(version, checked)}
              >
                {version}
              </WCheckBox>
            ))}
          </WScrollArea>
        </div>
      </WPopover>
    </>
  )
}
