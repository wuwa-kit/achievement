import { formatDate } from '../i18n/index.ts'
import { useRef, useState } from 'react'
import { WButton } from '../components/ui/WButton'
import { WPopover } from '../components/ui/WPopover'
import { WTooltip } from '../components/ui/WTooltip'
import { WSvg } from '../components/ui/WSvg'
import astriteIcon from '../assets/achievement-icons/astrite.png?no-inline'
import { achievementTabIcon } from '../lib/achievement-icons'
import type { HistorySummary } from '../stores/desktop'
import type { HistoryEntry, HistoryExportFormat } from './bridge'
import { useTranslation } from 'react-i18next'

export function HistoryCard({
  entry,
  summary,
  disabled,
  onExport,
  onDelete,
}: {
  entry: HistoryEntry
  summary: HistorySummary | null | undefined
  disabled: boolean
  onExport: (format: HistoryExportFormat) => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const exportRef = useRef<HTMLButtonElement>(null)
  const { t } = useTranslation()
  return (
    <div className="desktop-history-card flex items-center gap-4 rounded-[9px] border border-(--color-border) bg-(--color-surface) px-[18px] py-2.5">
      <div className="desktop-history-info flex min-w-0 flex-1 items-center gap-6">
        <div className="min-w-0 wrap-anywhere">
          <div className="desktop-history-uid text-[15px]">{`UID ${entry.uid}`}</div>
          <div className="desktop-history-time mt-1.5 text-[12px] text-(--color-muted)">
            {formatDate(entry.exportedAt)}
          </div>
        </div>
        <div className="grid shrink-0 grid-cols-[16px_auto_auto] gap-y-1.5 font-mono text-[13px] whitespace-nowrap text-(--color-muted) tabular-nums">
          <WTooltip text={t('desktop.achievements')}>
            <span className="desktop-history-count col-span-3 grid grid-cols-subgrid items-center">
              <img
                src={achievementTabIcon}
                alt=""
                width={16}
                height={16}
                className="brightness-0"
              />
              <span className="ml-1.5 text-right">{entry.completedCount}</span>
              <span>/{summary?.total ?? '—'}</span>
            </span>
          </WTooltip>
          <WTooltip text={t('ui.astrite')}>
            <span className="desktop-history-astrite col-span-3 grid grid-cols-subgrid items-center">
              <img src={astriteIcon} alt="" width={16} height={16} />
              <span className="ml-1.5 text-right">{summary?.completedAstrite ?? '—'}</span>
              <span>/{summary?.astrite ?? '—'}</span>
            </span>
          </WTooltip>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        <WTooltip text={t('common.deleteArchive')}>
          <WButton
            className="grid size-8 place-items-center rounded-md enabled:hover:bg-(--color-surface-soft)"
            data-testid="删除档案"
            disabled={disabled}
            onClick={onDelete}
          >
            <WSvg name="trash-2" size={18} />
          </WButton>
        </WTooltip>
        <WTooltip text={t('desktop.exportOptions')}>
          <WButton
            ref={exportRef}
            className="grid size-8 place-items-center rounded-md enabled:hover:bg-(--color-surface-soft) data-[expanded=true]:bg-(--color-surface-soft)"
            data-testid="历史记录导出"
            disabled={disabled}
            data-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <WSvg name="arrow-down-to-line" size={18} />
          </WButton>
        </WTooltip>
      </div>
      <WPopover
        open={open}
        onOpenChange={setOpen}
        anchorRef={exportRef}
        placement="bottom-end"
        className="desktop-history-menu [--popover-padding:5px]"
      >
        {(['web', 'json'] as const).map((format) => (
          <WButton
            key={format}
            className="block w-full rounded-[5px] px-3.5 py-2.5 text-left text-[13px] enabled:hover:bg-(--color-surface-soft)"
            disabled={disabled}
            onClick={() => {
              setOpen(false)
              onExport(format)
            }}
          >
            {format === 'json' ? t('common.exportAchievementFile') : t('desktop.' + format)}
          </WButton>
        ))}
      </WPopover>
    </div>
  )
}
