import { useTranslation } from 'react-i18next'
import { answerDialog, finishDialog, useDialogStore } from '../../stores/dialog'
import { WConfirmDialog } from './WConfirmDialog'

export function WDialogHost() {
  const { options, open } = useDialogStore()
  const { t } = useTranslation()
  return (
    <WConfirmDialog
      open={open}
      heading={options ? t(options.headingKey, options.values ?? {}) : ''}
      message={options ? t(options.messageKey, options.values ?? {}) : ''}
      cancelLabel={t(options?.cancelKey ?? 'common.cancel')}
      confirmLabel={t(options?.confirmKey ?? 'common.confirm')}
      confirmTone={options?.confirmTone}
      onOpenChange={(value) => {
        if (!value) answerDialog(false)
      }}
      onConfirm={() => answerDialog(true)}
      onAfterClose={finishDialog}
      testId="command-confirm-dialog"
      cancelTestId="command-confirm-cancel"
      confirmTestId="command-confirm-accept"
    />
  )
}
