import { useRef, useState } from 'react'
import { useResponsive, useUnmount } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { useViewerStore } from '../stores/viewer'
import { WIconButton, iconButtonClass } from './ui/WIconButton'
import { ArchiveDeleteDialog } from './ArchiveDeleteDialog'
import { WPopover } from './ui/WPopover'
import { usePopoverTrigger } from './ui/usePopoverTrigger'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'
import { WButton } from './ui/WButton'

export function ArchiveActions({ onImport }: { onImport: () => void }) {
  const { t } = useTranslation()
  const compact = !useResponsive().md
  const { data, activeKey, busy, receiving, download, deleteAccount } = useViewerStore()
  const [expanded, setExpanded] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; uid: string | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const disabled = busy || receiving
  const { anchorRef, triggerProps, popoverProps } = usePopoverTrigger(
    expanded && !disabled,
    (open) => (open ? openMenu() : closeMenu()),
  )
  const actionClass = compact
    ? 'flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-start text-sm enabled:hover:bg-(--color-surface-soft)'
    : `topbar-icon text-(--color-accent) ${iconButtonClass}`
  useUnmount(() => clearTimeout(hoverTimer.current))

  function openMenu() {
    clearTimeout(hoverTimer.current)
    setExpanded(true)
  }

  function closeMenu() {
    clearTimeout(hoverTimer.current)
    setExpanded(false)
  }

  return (
    <>
      {!compact && (
        <WTooltip text={t('ui.importAchievementFile')}>
          <WIconButton
            className="topbar-icon text-(--color-accent)"
            data-testid="import-achievement-file"
            onClick={onImport}
            disabled={disabled}
          >
            <WSvg name="upload" size={20} />
          </WIconButton>
        </WTooltip>
      )}
      {(data || compact) && (
        <div
          className="archive-actions flex-none"
          onPointerEnter={(event) => {
            if (event.pointerType !== 'mouse' || disabled) return
            clearTimeout(hoverTimer.current)
            if (!expanded) hoverTimer.current = setTimeout(openMenu, 200)
          }}
          onPointerLeave={(event) => {
            clearTimeout(hoverTimer.current)
            if (event.pointerType !== 'mouse' || event.currentTarget.matches(':focus-within'))
              return
            if (expanded) hoverTimer.current = setTimeout(closeMenu, 300)
          }}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) closeMenu()
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Escape' || event.defaultPrevented) return
            closeMenu()
            anchorRef.current?.focus()
          }}
        >
          <WTooltip text={t('common.archiveActions')}>
            <WIconButton
              {...triggerProps}
              className="topbar-icon text-(--color-accent) max-md:size-11"
              data-testid="档案更多操作"
              disabled={disabled}
            >
              <WSvg name="ellipsis" size={20} />
            </WIconButton>
          </WTooltip>
          <WPopover {...popoverProps} className="archive-actions-menu" offset={4}>
            <div
              className={`archive-actions-buttons flex gap-1 p-1 ${compact ? 'w-[240px] flex-col' : ''}`}
            >
              {compact && (
                <WButton
                  className={actionClass}
                  data-testid="import-achievement-file"
                  disabled={disabled}
                  onClick={() => {
                    closeMenu()
                    onImport()
                  }}
                >
                  <WSvg name="upload" size={20} />
                  <span>{t('ui.importAchievementFile')}</span>
                </WButton>
              )}
              {data && (
                <>
                  <WTooltip text={compact ? '' : t('common.deleteArchive')}>
                    <WButton
                      className={actionClass}
                      data-testid="删除档案"
                      disabled={disabled}
                      onClick={() => {
                        closeMenu()
                        setDeleteTarget({ key: activeKey, uid: data.uid })
                        setConfirmDelete(true)
                      }}
                    >
                      <WSvg name="trash-2" size={20} />
                      {compact && <span>{t('common.deleteArchive')}</span>}
                    </WButton>
                  </WTooltip>
                  <WTooltip text={compact ? '' : t('common.exportAchievementFile')}>
                    <WButton
                      className={actionClass}
                      data-testid="export-achievement-file"
                      disabled={disabled}
                      onClick={() => {
                        closeMenu()
                        download()
                      }}
                    >
                      <WSvg name="arrow-down-to-line" size={20} />
                      {compact && <span>{t('common.exportAchievementFile')}</span>}
                    </WButton>
                  </WTooltip>
                </>
              )}
            </div>
          </WPopover>
        </div>
      )}
      <ArchiveDeleteDialog
        open={confirmDelete}
        message={
          deleteTarget?.uid
            ? t('ui.deleteArchivePrompt', { uid: deleteTarget.uid })
            : t('ui.resetDefaultArchivePrompt')
        }
        onOpenChange={setConfirmDelete}
        onConfirm={() => {
          setConfirmDelete(false)
          if (deleteTarget) void deleteAccount(deleteTarget.key)
        }}
      />
    </>
  )
}
