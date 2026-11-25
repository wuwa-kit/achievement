import { useTranslation } from 'react-i18next'
import { useLanguageStore } from '../stores/language'
import { WDialog } from './ui/WDialog'
import { WIconButton } from './ui/WIconButton'
import { WScrollArea } from './ui/WScrollArea'
import { WSvg } from './ui/WSvg'
import { WTooltip } from './ui/WTooltip'

const downloadSources = [
  {
    id: 'github',
    icon: 'github',
    href: 'https://github.com/wuwa-kit/achievement/releases/latest',
  },
  { id: 'quark', icon: 'globe2', href: 'https://pan.quark.cn/s/2174c2b68b2c' },
  {
    id: 'baidu',
    icon: 'globe2',
    href: 'https://pan.baidu.com/s/1gGEZLyB4nThy8zWKj4DIyw?pwd=w88p',
  },
] as const

export function ExportToolDownloadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const language = useLanguageStore((state) => state.language)
  const showMirrors = language === 'zh-CN' || language === 'zh-TW'
  const sources = downloadSources.filter((source) => source.id === 'github' || showMirrors)

  return (
    <WDialog
      open={open}
      onOpenChange={onOpenChange}
      closeOnBackdrop
      className="w-[420px] overflow-hidden"
      data-testid="export-tool-download-dialog"
    >
      <div className="flex max-h-[calc(88dvh-2px)] flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-(--color-border) px-5 py-3">
          <WSvg name="arrow-down-to-line" size={22} className="shrink-0 text-(--color-accent)" />
          <div className="min-w-0 flex-1 text-base font-semibold wrap-anywhere">
            {t('ui.exportTool.download')}
          </div>
          <WTooltip text={t('ui.exportTool.closeDownload')}>
            <WIconButton
              variant="ghost"
              className="text-(--color-muted)"
              data-testid="close-export-tool-download-dialog"
              onClick={() => onOpenChange(false)}
            >
              <WSvg name="x" size={20} />
            </WIconButton>
          </WTooltip>
        </div>
        <WScrollArea className="min-h-0 space-y-2 overflow-auto p-5">
          {sources.map(({ id, icon, href }) => (
            <a
              key={id}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-14 items-center gap-3 rounded-lg border border-(--color-border) px-4 py-3 text-sm hover:bg-(--color-surface-soft)"
              data-testid={`export-tool-download-${id}`}
            >
              <WSvg name={icon} size={20} className="shrink-0 text-(--color-accent)" />
              <span className="min-w-0 flex-1 wrap-anywhere">
                <span className="block font-medium">{t(`ui.exportTool.${id}`)}</span>
                {id === 'baidu' && (
                  <span className="mt-1 block text-xs text-(--color-muted)">
                    {t('ui.exportTool.accessCode', { code: 'w88p' })}
                  </span>
                )}
              </span>
              <WSvg name="arrow-right" size={18} className="shrink-0 text-(--color-muted)" />
            </a>
          ))}
        </WScrollArea>
      </div>
    </WDialog>
  )
}
