import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useViewerStore } from '../stores/viewer'

import { formatDate } from '../i18n'
import { defaultArchiveKey } from '../lib/archives'
import { ArchiveActions } from './ArchiveActions'
import { ViewerActions } from './ViewerActions'
import { WInput } from './ui/WInput'
import { WIconButton } from './ui/WIconButton'
import { WSelect } from './ui/WSelect'
import { WOption } from './ui/WOption'
import { WSvg } from './ui/WSvg'

export function ViewerHeader({
  fileInput,
  onOpenNavigation,
}: {
  fileInput: RefObject<HTMLInputElement | null>
  onOpenNavigation: () => void
}) {
  const { t: tr } = useTranslation()
  const { archives, activeKey, busy, receiving, switchAccount, importFile } = useViewerStore(
    useShallow(({ archives, activeKey, busy, receiving, switchAccount, importFile }) => ({
      archives,
      activeKey,
      busy,
      receiving,
      switchAccount,
      importFile,
    })),
  )
  const defaultArchive = archives.find((archive) => archive.key === defaultArchiveKey)
  return (
    <div className="topbar flex h-[69px] flex-none items-center justify-between gap-3 border-b border-b-(--line) bg-(--color-surface) px-10 compact:px-[25px] narrow:h-[60px] narrow:gap-1.5 narrow:px-3.5">
      <div className="topbar-records flex min-w-0 items-center gap-2 max-md:flex-1 narrow:gap-1">
        <WIconButton
          variant="ghost"
          className="icon-button mobile-menu text-(--color-muted) hover:text-(--color-text) max-md:size-11 min-[901px]:hidden"
          data-testid="打开导航"
          onClick={onOpenNavigation}
        >
          <WSvg name="menu" size={20} />
        </WIconButton>
        <WSelect
          className="topbar-account pl-4 max-md:min-h-11 max-md:flex-1 narrow:pl-3 narrow:[--select-gap:4px] narrow:[--select-px:6px] narrow:[&_.archive-account-time]:hidden"
          data-testid="账号档案"
          value={activeKey}
          disabled={busy || receiving}
          onValueChange={(value) => void switchAccount(value)}
        >
          <WOption value={defaultArchiveKey}>
            {tr('common.defaultAccount')}
            {defaultArchive && (
              <span className="archive-account-time">
                {' · ' + formatDate(defaultArchive.capturedAt)}
              </span>
            )}
          </WOption>
          {archives
            .filter((a) => a.uid)
            .map((a) => (
              <WOption key={a.key} value={a.key}>
                {'UID ' + a.uid}
                <span className="archive-account-time">{' · ' + formatDate(a.capturedAt)}</span>
              </WOption>
            ))}
        </WSelect>
        <ArchiveActions onImport={() => fileInput.current?.click()} />
        <WInput
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="导入成就 JSON 文件"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void importFile(file)
          }}
        />
      </div>
      <ViewerActions />
    </div>
  )
}
