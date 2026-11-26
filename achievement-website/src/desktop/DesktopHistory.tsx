import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useDesktopStore } from '../stores/desktop'

import { useState } from 'react'
import { ArchiveDeleteDialog } from '../components/ArchiveDeleteDialog'
import { HistoryCard } from './HistoryCard'

export function DesktopHistory() {
  const { t } = useTranslation()
  const { loaded, pending, state, exportHistory, deleteHistory } = useDesktopStore(
    useShallow(({ loaded, pending, state, exportHistory, deleteHistory }) => ({
      loaded,
      pending,
      state,
      exportHistory,
      deleteHistory,
    })),
  )
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; uid: string } | null>(null)
  const disabled = !loaded || pending || state.busy
  return (
    <>
      {loaded && (
        <div className="desktop-history mt-7 flex flex-col gap-3">
          <div className="desktop-history-heading text-[16px]">{t('desktop.history')}</div>
          {!state.history?.length && (
            <div className="desktop-history-empty pb-5 text-[13px] text-(--color-muted)">
              {t('desktop.noHistory')}
            </div>
          )}
          {state.history?.map((entry) => (
            <HistoryCard
              key={entry.id}
              entry={entry}
              disabled={disabled}
              onExport={(format) => void exportHistory(entry.id, format)}
              onDelete={() => {
                setDeleteTarget({ id: entry.id, uid: entry.uid })
              }}
            />
          ))}
        </div>
      )}
      <ArchiveDeleteDialog
        open={!!deleteTarget}
        message={t('desktop.deleteHistoryPrompt', { uid: deleteTarget?.uid ?? '' })}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) void deleteHistory(deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
