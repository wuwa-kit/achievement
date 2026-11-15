import { useTranslation } from 'react-i18next'
import { WConfirmDialog } from './ui/WConfirmDialog'

export function ArchiveDeleteDialog({
  open,
  message,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  message: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <WConfirmDialog
      open={open}
      heading={t('common.deleteArchive')}
      message={message}
      cancelLabel={t('common.cancel')}
      confirmLabel={t('common.deleteArchive')}
      confirmTone="danger"
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      testId="删除档案确认"
      cancelTestId="取消删除档案"
      confirmTestId="确认删除档案"
    />
  )
}
