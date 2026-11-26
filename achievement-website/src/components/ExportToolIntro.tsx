import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WDialog } from './ui/WDialog'
import { WIconButton } from './ui/WIconButton'
import { WScrollArea } from './ui/WScrollArea'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'
import { WButton } from './ui/WButton'
import { useExportToolStore } from '../stores/export-tool'

export function ExportToolIntro() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const openDownload = useExportToolStore((state) => state.openDownload)

  return (
    <>
      <WTooltip text={t('ui.exportTool.title')}>
        <WIconButton
          className="text-(--color-accent) max-md:size-11"
          data-testid="export-tool-intro"
          data-expanded={open}
          onClick={() => setOpen(true)}
        >
          <WSvg name="wrench" size={20} />
        </WIconButton>
      </WTooltip>
      <WDialog
        open={open}
        onOpenChange={setOpen}
        closeOnBackdrop
        className="w-[540px] overflow-hidden"
        data-testid="export-tool-dialog"
      >
        <div className="flex max-h-[calc(88dvh-2px)] flex-col">
          <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border) px-5 py-3">
            <WSvg name="wrench" size={22} className="shrink-0 text-(--color-accent)" />
            <div className="min-w-0 flex-1 text-base font-semibold wrap-anywhere">
              {t('ui.exportTool.title')}
            </div>
            <WTooltip text={t('ui.exportTool.close')}>
              <WIconButton
                variant="ghost"
                className="text-(--color-muted)"
                data-testid="close-export-tool-dialog"
                onClick={() => setOpen(false)}
              >
                <WSvg name="x" size={20} />
              </WIconButton>
            </WTooltip>
          </div>
          <WScrollArea className="min-h-0 overflow-auto">
            <div className="space-y-5 p-5 text-sm leading-relaxed wrap-anywhere">
              <div className="text-(--color-muted)">{t('ui.exportTool.description')}</div>
              <div className="space-y-3 rounded-lg bg-(--color-surface-soft) p-4">
                {(['step1', 'step2', 'step3'] as const).map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="inline-grid size-6 shrink-0 place-items-center rounded-full border border-(--color-border) text-xs text-(--color-accent)">
                      {index + 1}
                    </span>
                    <span className="min-w-0 pt-0.5">{t(`ui.exportTool.${step}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </WScrollArea>
          <div className="flex shrink-0 flex-wrap gap-2 border-t border-(--color-border) p-5 text-sm leading-relaxed max-[420px]:flex-col">
            <a
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-(--color-accent) px-4 py-2.5 text-center font-medium text-(--color-on-accent) hover:bg-(--color-accent-hover)"
              href="https://www.bilibili.com/video/BV1p8sW6TEPJ/"
              target="_blank"
              rel="noreferrer"
              data-testid="export-tool-video"
            >
              <WSvg name="play" size={18} className="shrink-0" />
              {t('ui.exportTool.watchVideo')}
            </a>
            <WButton
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-(--color-border) px-4 py-2.5 text-center font-medium hover:bg-(--color-surface-soft)"
              onClick={() => openDownload()}
              data-testid="export-tool-download"
            >
              <WSvg name="arrow-down-to-line" size={18} className="shrink-0" />
              {t('ui.exportTool.download')}
            </WButton>
          </div>
        </div>
      </WDialog>
    </>
  )
}
