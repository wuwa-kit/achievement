import { tr } from '../i18n/index.ts'
import { z } from 'zod'
import type { ExportData } from './data.ts'

const progress = z
  .object({
    id: z.number().int().positive(),
    previousId: z.number().int(),
    nextId: z.number().int(),
    currentProgress: z.number().finite().nonnegative().nullable(),
    maxProgress: z.number().finite().nonnegative().nullable(),
    hasGetReward: z.boolean().nullable(),
    finishTimeRaw: z.number().finite().nonnegative().nullable(),
  })
  .strict()
export const accountSchema = z
  .object({
    schemaVersion: z.literal(3),
    kind: z.literal('account-progress'),
    complete: z.literal(true),
    uid: z
      .string()
      .regex(/^[1-9][0-9]*$/)
      .nullable(),
    capturedAt: z.iso.datetime({ offset: true }),
    resourceFingerprint: z.string().min(1),
    count: z.number().int().positive(),
    completedCount: z.number().int().nonnegative(),
    starCount: z.number().int().nonnegative(),
    groupStates: z.array(
      z.object({ id: z.number().int().positive(), unlocked: z.boolean() }).strict(),
    ),
    achievements: z.array(progress),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      data.count !== data.achievements.length ||
      new Set(data.achievements.map((a) => a.id)).size !== data.count
    )
      context.addIssue({ code: 'custom', message: tr('ui.invalidAccountCount') })
    if (new Set(data.groupStates.map((g) => g.id)).size !== data.groupStates.length)
      context.addIssue({ code: 'custom', message: tr('ui.duplicateGroups') })
  })
export type AccountData = z.infer<typeof accountSchema>

export function isAccountExport(input: unknown) {
  return (
    !!input && typeof input === 'object' && 'schemaVersion' in input && input.schemaVersion === 3
  )
}

export function parseAccount(input: unknown): AccountData {
  const parsed = accountSchema.safeParse(input)
  if (!parsed.success) throw new Error(tr('ui.invalidAccount') + parsed.error.issues[0].message)
  return parsed.data
}

export function mergeAccount(account: AccountData, catalog: ExportData) {
  const states = new Map(account.achievements.map((a) => [a.id, a]))
  const unlocked = new Map(account.groupStates.map((g) => [g.id, g.unlocked]))
  const knownIds = new Set(catalog.achievements.map((a) => a.id))
  const unknownIds = account.achievements.filter((a) => !knownIds.has(a.id)).map((a) => a.id)
  const groups = new Map(catalog.categories.flatMap((c) => c.groups.map((g) => [g.id, g])))
  const achievements = catalog.achievements
    .filter((c) => c.inMainMenu)
    .map((c) => {
      const p = states.get(c.id)
      const currentProgress = p?.currentProgress ?? null
      const maxProgress = p?.maxProgress ?? null
      const hasGetReward = p?.hasGetReward ?? null
      const finishTimeRaw = p?.finishTimeRaw ?? null
      const status =
        hasGetReward === true
          ? 'reward_claimed'
          : (finishTimeRaw ?? 0) > 0
            ? 'completed'
            : currentProgress === null || maxProgress === null
              ? 'unknown'
              : 'in_progress'
      const previousId = p?.previousId ?? c.previousId
      const nextId = p?.nextId ?? c.nextId
      const reason =
        !p || maxProgress === null
          ? 'progress_unavailable'
          : !groups.get(c.groupId)?.enabled || unlocked.get(c.groupId) !== true
            ? 'group_unavailable'
            : c.hidden && status !== 'completed' && status !== 'reward_claimed'
              ? 'hidden_until_completed'
              : previousId !== -1 && states.get(previousId)?.hasGetReward !== true
                ? 'previous_reward_unclaimed'
                : hasGetReward === true && nextId > 0
                  ? 'replaced_by_next_stage'
                  : 'visible'
      return {
        ...c,
        currentProgress,
        maxProgress,
        hasGetReward,
        finishTimeRaw,
        previousId,
        nextId,
        status,
        clientState:
          hasGetReward === true
            ? 'HaveGetReward'
            : (finishTimeRaw ?? 0) > 0
              ? 'CanGetReward'
              : 'UnFinished',
        visibleForAccount: reason === 'visible',
        visibilityReason: reason,
        progressSource: p ? 'account' : 'catalog-only',
      }
    })
  return {
    schemaVersion: 2,
    complete: true,
    uid: account.uid,
    capturedAt: account.capturedAt,
    count: achievements.length,
    mainMenuCount: achievements.length,
    otherGameplayCount: 0,
    completedCount: account.completedCount,
    starCount: account.starCount,
    languages: catalog.languages,
    languageCoverage: catalog.languageCoverage,
    categories: catalog.categories.map((c) => ({
      id: c.id,
      texts: c.texts,
      groups: [...c.groups]
        .sort((a, b) => a.sort - b.sort || a.id - b.id)
        .map((g) => ({
          ...g,
          unlocked: unlocked.get(g.id) === true,
        })),
    })),
    achievements,
    // Persist the unmodified account input so future catalogs can resolve new IDs.
    accountSnapshot: account,
    unknownCatalogIds: unknownIds,
  }
}
