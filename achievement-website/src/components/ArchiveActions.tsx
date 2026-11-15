import { useRef, useState } from 'react'
import { useUnmount } from 'ahooks'
import { useTranslation } from 'react-i18next'
import { useViewerStore } from '../stores/viewer'
import { WButton } from './ui/WButton'
import { ArchiveDeleteDialog } from './ArchiveDeleteDialog'
import { WPopover } from './ui/WPopover'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'

export function ArchiveActions() {
  const { t } = useTranslation()
  const { data, activeKey, busy, receiving, download, deleteAccount } = useViewerStore()
  const [expanded, setExpanded] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ key: string; uid: string | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const disabled = busy || receiving
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
      {data && (
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
            if (event.key !== 'Escape') return
            closeMenu()
            anchorRef.current?.focus()
          }}
        >
          <WTooltip text={t('common.archiveActions')}>
            <WButton
              ref={anchorRef}
              className="topbar-icon inline-grid size-9 flex-none place-items-center rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-accent) enabled:hover:bg-(--color-surface-soft)"
              data-testid="档案更多操作"
              disabled={disabled}
              data-expanded={expanded && !disabled}
              onClick={openMenu}
            >
              <WSvg name="ellipsis" size={18} />
            </WButton>
          </WTooltip>
          <WPopover
            open={expanded && !disabled}
            onOpenChange={(open) => (open ? openMenu() : closeMenu())}
            anchorRef={anchorRef}
            className="archive-actions-menu"
            offset={4}
          >
            <div className="archive-actions-buttons flex gap-1 p-1">
              <WTooltip text={t('common.deleteArchive')}>
                <WButton
                  className="topbar-icon inline-grid size-9 flex-none place-items-center rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-accent) enabled:hover:bg-(--color-surface-soft)"
                  data-testid="删除档案"
                  disabled={disabled}
                  onClick={() => {
                    closeMenu()
                    setDeleteTarget({ key: activeKey, uid: data.uid })
                    setConfirmDelete(true)
                  }}
                >
                  <WSvg name="trash-2" size={17} />
                </WButton>
              </WTooltip>
              <WTooltip text={t('common.exportAchievementFile')}>
                <WButton
                  className="topbar-icon inline-grid size-9 flex-none place-items-center rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-accent) enabled:hover:bg-(--color-surface-soft)"
                  data-testid="export-achievement-file"
                  disabled={disabled}
                  onClick={() => {
                    closeMenu()
                    download()
                  }}
                >
                  <WSvg name="arrow-down-to-line" size={18} />
                </WButton>
              </WTooltip>
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
