import { tr } from '../i18n/index.ts'
import { z } from 'zod'
import { exclusionReason } from './exclusions.ts'
import { isAccountExport, mergeAccount, parseAccount, type AccountData } from './account.ts'

const textSchema = z.object({
  title: z.string().nullable(),
  description: z.string().nullable().optional(),
})
const textsSchema = z.record(z.string(), textSchema)
const nullableNumber = z.number().finite().nullable()
export const achievementSchema = z
  .object({
    id: z.number().int(),
    categoryId: z.number().int(),
    groupId: z.number().int(),
    hidden: z.boolean(),
    inMainMenu: z.boolean(),
    visibleForAccount: z.boolean(),
    visibilityReason: z.string(),
    clientState: z.string(),
    previousId: z.number().int(),
    nextId: z.number().int(),
    currentProgress: nullableNumber,
    maxProgress: nullableNumber,
    hasGetReward: z.boolean().nullable(),
    finishTimeRaw: nullableNumber,
    status: z.enum(['reward_claimed', 'completed', 'in_progress', 'unknown']),
    titleKey: z.string().nullable(),
    descriptionKey: z.string().nullable(),
    level: z.number(),
    astrite: z.number().nonnegative(),
    rewards: z.array(z.object({ itemId: z.number(), quantity: z.number() })),
    texts: textsSchema,
  })
  .passthrough()
const groupSchema = z
  .object({
    id: z.number(),
    categoryId: z.number(),
    sort: z.number(),
    enabled: z.boolean(),
    unlocked: z.boolean(),
    texts: textsSchema,
    achievementIds: z.array(z.number()),
  })
  .passthrough()
const categorySchema = z
  .object({ id: z.number(), texts: textsSchema, groups: z.array(groupSchema) })
  .passthrough()
const exportSchema = z
  .object({
    schemaVersion: z.literal(2),
    uid: z
      .union([z.string(), z.number().int().safe().positive()])
      .nullish()
      .transform((value) => {
        const uid = String(value ?? '').trim()
        return /^\d+$/.test(uid) ? uid.replace(/^0+/, '') || null : null
      }),
    complete: z.literal(true),
    capturedAt: z.iso.datetime({ offset: true }),
    count: z.number().int().positive(),
    completedCount: z.number(),
    starCount: z.number(),
    mainMenuCount: z.number(),
    otherGameplayCount: z.number(),
    languages: z.array(z.string()).min(1),
    languageCoverage: z.array(
      z
        .object({
          language: z.string(),
          available: z.boolean(),
          mainTitles: z.number(),
          mainCount: z.number(),
        })
        .passthrough(),
    ),
    categories: z.array(categorySchema),
    achievements: z.array(achievementSchema),
  })
  .passthrough()
export type Achievement = z.infer<typeof achievementSchema>
export type ExportData = z.infer<typeof exportSchema>
export type Category = ExportData['categories'][number]
export type Group = Category['groups'][number]
export type StatusFilter = 'all' | 'finished' | 'in_progress' | 'unknown'
export type VisibilityFilter = 'all' | 'hidden' | 'normal' | 'visible' | 'invisible'
export type Filters = {
  query: string
  language: string
  category?: number | null
  group: number | null
  hideCompleted?: boolean
  status?: StatusFilter
  visibility?: VisibilityFilter
  sort?: 'id' | 'reward' | 'progress'
}

export function readExport(input: unknown): ExportData {
  const result = exportSchema.safeParse(input)
  if (!result.success) throw new Error(tr('ui.invalidExport'))
  const data = result.data
  const ids = new Set(data.achievements.map((a) => a.id))
  const main = data.achievements.filter((a) => a.inMainMenu)
  if (
    ids.size !== data.count ||
    data.achievements.length !== data.count ||
    main.length !== data.mainMenuCount ||
    data.count - main.length !== data.otherGameplayCount
  )
    throw new Error(tr('ui.invalidCount'))
  const index = new Map(data.achievements.map((a) => [a.id, a]))
  const referenced = new Set<number>()
  for (const category of data.categories)
    for (const group of category.groups) {
      if (group.categoryId !== category.id) throw new Error(tr('ui.invalidCategory'))
      for (const id of group.achievementIds) {
        const item = index.get(id)
        if (
          !item?.inMainMenu ||
          item.groupId !== group.id ||
          item.categoryId !== category.id ||
          referenced.has(id)
        )
          throw new Error(tr('ui.invalidReferences'))
        referenced.add(id)
      }
    }
  if (referenced.size !== main.length) throw new Error(tr('ui.incompleteCatalog'))
  return data
}

export function parseExport(input: unknown, catalog?: ExportData): ExportData {
  if (isAccountExport(input)) {
    const account = parseAccount(input)
    if (!catalog) throw new Error(tr('ui.noExport'))
    input = mergeAccount(account, catalog)
  }
  return normalizeExport(readExport(input))
}

export function normalizeExport(data: ExportData): ExportData {
  const main = data.achievements.filter((a) => a.inMainMenu)
  // Validate old full exports before narrowing them; also applies to IndexedDB restoration.
  const retained = main.filter((a) => !exclusionReason(a))
  const retainedIds = new Set(retained.map((a) => a.id))
  const mainGroupIds = new Set(data.categories.flatMap((c) => c.groups.map((g) => g.id)))
  return {
    ...data,
    achievements: retained,
    count: retained.length,
    mainMenuCount: retained.length,
    categories: data.categories.map((c) => ({
      ...c,
      groups: c.groups.map((g) => ({
        ...g,
        achievementIds: g.achievementIds.filter((id) => retainedIds.has(id)),
      })),
    })),
    otherGameplayCount: 0,
    ...(typeof data.clientModelCount === 'number'
      ? {
          clientModelCount: retained.filter((a) => a.progressSource !== 'catalog-only').length,
          catalogOnlyCount: retained.filter((a) => a.progressSource === 'catalog-only').length,
        }
      : {}),
    unknownCount: retained.filter((a) => a.status === 'unknown').length,
    ...(Array.isArray(data.groupStates)
      ? { groupStates: data.groupStates.filter((g) => mainGroupIds.has((g as { id: number }).id)) }
      : {}),
  }
}

export function exportPayload(data: ExportData): unknown {
  return data.accountSnapshot ?? data
}

export function editAchievement(
  data: ExportData,
  id: number,
  completed: boolean,
  catalog?: ExportData,
): ExportData {
  const item = data.achievements.find((entry) => entry.id === id)
  if (!item || (item.status !== 'unknown' && isFinished(item) === completed)) return data
  if (completed && isStageWaiting(item, getAchievementStages(data.achievements).get(id)))
    return data

  const capturedAt = new Date(Math.max(Date.now(), Date.parse(data.capturedAt) + 1)).toISOString()
  const progress = {
    id,
    previousId: item.previousId,
    nextId: item.nextId,
    currentProgress: completed ? Math.max(1, item.maxProgress ?? 0) : 0,
    maxProgress: Math.max(1, item.maxProgress ?? 0),
    hasGetReward: false,
    finishTimeRaw: completed ? Math.floor(Date.parse(capturedAt) / 1000) : null,
  }
  const delta = Number(completed) - Number(isFinished(item))
  const totals = {
    capturedAt,
    completedCount: Math.max(0, data.completedCount + delta),
    starCount: Math.max(0, data.starCount + delta * item.astrite),
  }
  const account = data.accountSnapshot as AccountData | undefined
  if (account?.schemaVersion === 3) {
    const achievements = [...account.achievements.filter((entry) => entry.id !== id), progress]
    return parseExport({ ...account, ...totals, count: achievements.length, achievements }, catalog)
  }

  return {
    ...data,
    ...totals,
    preview: false,
    achievements: data.achievements.map((entry) =>
      entry.id === id
        ? {
            ...entry,
            ...progress,
            status: completed ? 'completed' : 'in_progress',
            clientState: completed ? 'CanGetReward' : 'UnFinished',
            progressSource: 'manual',
          }
        : entry,
    ),
  }
}

// Render text as text, not HTML. Remove only known Unreal rich-text tags.
export function plainText(text: string | null | undefined): string {
  return (text ?? '')
    .replace(/<\/?(?:color|size|b|i|u)(?:=[^>]*)?>|<\/>/gi, '')
    .replace(/\\n/g, '\n')
}
export function titleOf(
  value: { texts: z.infer<typeof textsSchema> },
  language: string,
  fallback: string,
): string {
  return plainText(value.texts[language]?.title) || fallback
}
export function isFinished(item: Achievement): boolean {
  return item.status === 'reward_claimed' || item.status === 'completed'
}

export function getAchievementStars(item: Achievement, stages?: readonly Achievement[]) {
  const level = Math.min(3, Math.max(1, Math.trunc(item.level)))
  if (item.nextId === -1) return { slots: level, lit: isFinished(item) ? level : 0 }
  if (isFinished(item)) return { slots: 3, lit: level }
  if (item.visibleForAccount && item.status !== 'unknown') return { slots: 3, lit: level - 1 }

  // The website also lists stages that the game would hide. Use recorded progress
  // from earlier stages for those rows, including when there is no account snapshot.
  let lit = 0
  for (const stage of stages ?? []) {
    if (stage.id === item.id) break
    if (isFinished(stage)) lit = Math.max(lit, Math.min(level - 1, Math.trunc(stage.level)))
  }
  return { slots: 3, lit }
}

export function getAchievementStages(items: Achievement[]) {
  const byId = new Map(items.map((item) => [item.id, item]))
  const nextById = new Map<number, Achievement>()
  const following = new Set<number>()
  for (const item of items) {
    const next = item.nextId > 0 ? byId.get(item.nextId) : undefined
    if (next?.previousId !== item.id || next.groupId !== item.groupId) continue
    nextById.set(item.id, next)
    following.add(next.id)
  }

  const stagesById = new Map<number, Achievement[]>()
  for (const item of items) {
    if (following.has(item.id) || !nextById.has(item.id)) continue
    const stages = [item]
    for (let next = nextById.get(item.id); next; next = nextById.get(next.id)) stages.push(next)
    for (const stage of stages) stagesById.set(stage.id, stages)
  }
  return stagesById
}

export function isStageWaiting(item: Achievement, stages?: Achievement[]): boolean {
  const previous = stages?.find((stage) => stage.id === item.previousId)
  return previous !== undefined && !isFinished(previous) && !isFinished(item)
}
export function progressRatio(item: Achievement): number {
  if (isFinished(item)) return 1
  if (item.currentProgress === null || item.maxProgress === null || item.maxProgress <= 0) return 0
  return Math.min(1, Math.max(0, item.currentProgress / item.maxProgress))
}
export function filterAchievements(
  items: Achievement[],
  filters: Filters,
  stagesById = getAchievementStages(items),
  hiddenCompletedIds?: ReadonlySet<number>,
): Achievement[] {
  const query = filters.query.trim().toLocaleLowerCase()
  function matchesQuery(item: Achievement) {
    const translated = item.texts[filters.language]
    const searchable =
      `${item.id} ${plainText(translated?.title)} ${plainText(translated?.description)} ${plainText(item.texts['zh-Hans']?.title)} ${plainText(item.texts['zh-Hans']?.description)}`.toLocaleLowerCase()
    return searchable.includes(query)
  }
  const matches = items
    .filter((item) => {
      if (!item.inMainMenu || exclusionReason(item)) return false
      if (filters.category != null && item.categoryId !== filters.category) return false
      if (filters.group !== null && item.groupId !== filters.group) return false
      if (filters.hideCompleted && (hiddenCompletedIds?.has(item.id) ?? isFinished(item)))
        return false
      if (filters.status === 'finished' && !isFinished(item)) return false
      if (
        filters.status &&
        !['all', 'finished'].includes(filters.status) &&
        item.status !== filters.status
      )
        return false
      if (
        (filters.visibility === 'hidden' && !item.hidden) ||
        (filters.visibility === 'normal' && item.hidden)
      )
        return false
      if (
        (filters.visibility === 'visible' && !item.visibleForAccount) ||
        (filters.visibility === 'invisible' && item.visibleForAccount)
      )
        return false
      return !query || (stagesById.get(item.id) ?? [item]).some(matchesQuery)
    })
    .sort((a, b) =>
      filters.sort === 'reward'
        ? b.astrite - a.astrite || a.id - b.id
        : filters.sort === 'progress'
          ? progressRatio(b) - progressRatio(a) || a.id - b.id
          : a.id - b.id,
    )
  const remaining = new Set(matches.map((item) => item.id))
  return matches.flatMap((item) =>
    (stagesById.get(item.id) ?? [item]).filter((stage) => remaining.delete(stage.id)),
  )
}
export function summarize(items: Achievement[]) {
  items = items.filter((a) => !exclusionReason(a))
  return {
    total: items.length,
    finished: items.filter(isFinished).length,
    hidden: items.filter((a) => a.hidden).length,
    completedAstrite: items.filter(isFinished).reduce((sum, a) => sum + a.astrite, 0),
    incompleteAstrite: items
      .filter((a) => a.status === 'in_progress')
      .reduce((sum, a) => sum + a.astrite, 0),
    unknownAstrite: items
      .filter((a) => a.status === 'unknown')
      .reduce((sum, a) => sum + a.astrite, 0),
    unknown: items.filter((a) => a.status === 'unknown').length,
    astrite: items.reduce((sum, a) => sum + a.astrite, 0),
  }
}
