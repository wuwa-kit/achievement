import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ExcludedCatalogAchievement } from '../lib/catalog'
import { plainText, type Achievement } from '../lib/data'
import { getDuplicateAchievementId, type ExclusionReason } from '../lib/exclusions'
import { WButton } from './ui/WButton'
import { WDialog } from './ui/WDialog'
import { WScrollArea } from './ui/WScrollArea'
import { WSvg } from './ui/WSvg'

type AchievementText = Pick<Achievement, 'id' | 'texts'>

function AchievementDescription({
  item,
  language,
  reason,
}: {
  item: AchievementText
  language: string
  reason?: ExclusionReason
}) {
  const { t } = useTranslation()
  const text = item.texts[language]
  return (
    <div className="min-w-0 px-3 py-2.5 wrap-anywhere">
      <div className="flex items-baseline gap-2 text-[13px] font-medium">
        <span className="shrink-0 font-mono text-xs text-(--color-muted)">#{item.id}</span>
        <span className="min-w-0">{plainText(text?.title) || t('ui.missingTitle')}</span>
      </div>
      <div className="mt-0.5 text-xs leading-relaxed whitespace-pre-line text-(--color-muted)">
        {plainText(text?.description) || t('ui.missingDescription')}
      </div>
      {reason && (
        <div className="mt-0.5 text-xs leading-relaxed text-(--color-gold)">
          {t(`ui.catalogStats.exclusionReasons.${reason}`, {
            id: getDuplicateAchievementId(item.id),
          })}
        </div>
      )}
    </div>
  )
}

export function CatalogStatistics({
  language,
  includedTotal,
  excludedItems,
  exclusiveGroups,
  achievableTotal,
  astrite,
}: {
  language: string
  includedTotal: number
  excludedItems: readonly ExcludedCatalogAchievement[]
  exclusiveGroups: readonly (readonly AchievementText[])[]
  achievableTotal: number
  astrite: number
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const catalogTotal = includedTotal + excludedItems.length
  const statistics = [
    {
      label: t('ui.catalogStats.total'),
      value: t('ui.catalogStats.collectedCount', { value0: catalogTotal }),
    },
    {
      label: t('ui.catalogStats.collected'),
      value: t('ui.catalogStats.collectedCount', { value0: includedTotal }),
    },
    {
      label: t('ui.catalogStats.excluded'),
      value: t('ui.catalogStats.collectedCount', { value0: excludedItems.length }),
    },
    {
      label: t('ui.catalogStats.exclusive'),
      value: t('ui.catalogStats.exclusiveCount', {
        groups: exclusiveGroups.length,
        entries: exclusiveGroups.reduce((total, group) => total + group.length, 0),
      }),
    },
    {
      label: t('ui.catalogStats.achievable'),
      value: t('ui.catalogStats.achievableCount', { value0: achievableTotal }),
    },
    { label: t('ui.catalogStats.astrite'), value: astrite },
  ]

  return (
    <>
      <WButton
        data-testid="catalog-statistics-trigger"
        data-expanded={open}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-(--color-nav-muted) hover:bg-(--color-nav-hover) hover:text-(--color-nav-text) data-[expanded=true]:bg-(--color-nav-hover) data-[expanded=true]:text-(--color-nav-text)"
        onClick={() => setOpen(true)}
      >
        <span className="font-mono text-xs tabular-nums">{catalogTotal}</span>
        <WSvg name="info" size={14} />
      </WButton>
      <WDialog
        open={open}
        onOpenChange={setOpen}
        closeOnBackdrop
        className="w-[620px] overflow-hidden lg:w-[960px]"
        data-testid="catalog-statistics-dialog"
      >
        <div className="flex max-h-[calc(88dvh-2px)] flex-col">
          <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-(--color-border) px-5">
            <div className="text-base font-semibold">{t('ui.catalogStats.title')}</div>
            <WButton
              className="inline-grid size-8 shrink-0 place-items-center rounded-md text-(--color-muted) hover:bg-(--color-surface-soft) hover:text-(--color-text)"
              onClick={() => setOpen(false)}
              data-testid="close-catalog-statistics"
            >
              <WSvg name="x" size={18} />
            </WButton>
          </div>
          <div className="shrink-0 px-5 pt-4 pb-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3 rounded-lg bg-(--color-surface-soft) px-3 py-3.5 sm:grid-cols-3">
              {statistics.map(({ label, value }) => (
                <div className="min-w-0" key={label}>
                  <div className="text-[11px] wrap-anywhere text-(--color-muted)">{label}</div>
                  <div className="mt-0.5 text-sm font-semibold wrap-anywhere tabular-nums">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <WScrollArea
            className="min-h-0 overflow-auto overscroll-contain"
            data-testid="catalog-statistics-scroll"
          >
            <div className="grid gap-5 px-5 pt-2 pb-5">
              {excludedItems.length > 0 && (
                <div className="@container" data-testid="catalog-excluded-achievements">
                  <div className="mb-2 text-sm font-semibold">{t('ui.catalogStats.excluded')}</div>
                  <div className="grid grid-cols-1 gap-2 @min-[600px]:grid-cols-2">
                    {excludedItems.map((item) => (
                      <div
                        key={item.id}
                        className="min-w-0 rounded-lg border border-(--color-border)"
                      >
                        <AchievementDescription
                          item={item}
                          language={language}
                          reason={item.reason}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {exclusiveGroups.length > 0 && (
                <div data-testid="catalog-exclusive-achievements">
                  <div className="mb-2 text-sm font-semibold">{t('ui.catalogStats.exclusive')}</div>
                  <div className="grid gap-2">
                    {exclusiveGroups.map((group) => (
                      <div
                        key={group[0].id}
                        className="grid divide-y divide-(--color-border) rounded-lg border border-(--color-border) sm:grid-flow-col sm:auto-cols-fr sm:divide-x sm:divide-y-0"
                        data-testid="catalog-exclusive-group"
                      >
                        {group.map((item) => (
                          <AchievementDescription key={item.id} item={item} language={language} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </WScrollArea>
        </div>
      </WDialog>
    </>
  )
}
