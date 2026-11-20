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
  exclusive?: { ids: readonly number[]; replace: boolean },
): ExportData {
  const item = data.achievements.find((entry) => entry.id === id)
  if (!item) return data
  const stages = getAchievementStages(data.achievements).get(id) ?? [item]
  const index = stages.findIndex((entry) => entry.id === id)
  const targets = completed ? stages.slice(0, index + 1) : stages.slice(index)
  const changed = targets.filter(
    (entry) => entry.status === 'unknown' || isFinished(entry) !== completed,
  )

  const replaced = completed
    ? data.achievements.filter(
        (entry) => entry.id !== id && exclusive?.ids.includes(entry.id) && isFinished(entry),
      )
    : []
  if (replaced.length && !exclusive?.replace) return data
  if (!changed.length && !replaced.length) return data

  const capturedAt = new Date(Math.max(Date.now(), Date.parse(data.capturedAt) + 1)).toISOString()
  function progressFor(entry: Achievement, finished: boolean) {
    const maxProgress = Math.max(1, entry.maxProgress ?? 0)
    return {
      id: entry.id,
      previousId: entry.previousId,
      nextId: entry.nextId,
      currentProgress: finished ? maxProgress : 0,
      maxProgress,
      hasGetReward: false,
      finishTimeRaw: finished ? Math.floor(Date.parse(capturedAt) / 1000) : null,
    }
  }
  const changes = [
    ...changed.map((entry) => progressFor(entry, completed)),
    ...replaced.map((entry) => progressFor(entry, false)),
  ]
  const byId = new Map(changes.map((progress) => [progress.id, progress]))
  const completedIds = new Set(completed ? changed.map((entry) => entry.id) : [])
  const completedDelta = changed.reduce(
    (sum, entry) => sum + Number(completed) - Number(isFinished(entry)),
    -replaced.length,
  )
  const astriteDelta = changed.reduce(
    (sum, entry) => sum + (Number(completed) - Number(isFinished(entry))) * entry.astrite,
    -replaced.reduce((sum, entry) => sum + entry.astrite, 0),
  )
  const totals = {
    capturedAt,
    completedCount: Math.max(0, data.completedCount + completedDelta),
    starCount: Math.max(0, data.starCount + astriteDelta),
  }
  const account = data.accountSnapshot as AccountData | undefined
  if (account?.schemaVersion === 3) {
    const achievements = [
      ...account.achievements.filter((entry) => !byId.has(entry.id)),
      ...changes,
    ]
    return parseExport({ ...account, ...totals, count: achievements.length, achievements }, catalog)
  }

  return {
    ...data,
    ...totals,
    preview: false,
    achievements: data.achievements.map((entry) => {
      const progress = byId.get(entry.id)
      if (!progress) return entry
      const finished = completedIds.has(entry.id)
      return {
        ...entry,
        ...progress,
        status: finished ? 'completed' : 'in_progress',
        clientState: finished ? 'CanGetReward' : 'UnFinished',
        progressSource: 'manual',
      }
    }),
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

export function progressRatio(item: Achievement): number {
  if (isFinished(item)) return 1
  if (item.currentProgress === null || item.maxProgress === null || item.maxProgress <= 0) return 0
  return Math.min(1, Math.max(0, item.currentProgress / item.maxProgress))
}
type ExclusiveAchievements = ReadonlyMap<number, readonly Achievement[]>

export function getExclusiveAchievements(
  items: Achievement[],
  groups: readonly (readonly number[])[],
): ExclusiveAchievements {
  const byId = new Map(items.map((item) => [item.id, item]))
  const exclusiveById = new Map<number, Achievement[]>()
  for (const ids of groups) {
    const members = ids.flatMap((id) => byId.get(id) ?? [])
    if (members.length < 2) continue
    for (const item of members) exclusiveById.set(item.id, members)
  }
  return exclusiveById
}

export function getAchievementUnits(items: Achievement[], exclusiveById?: ExclusiveAchievements) {
  const remaining = new Map(items.map((item) => [item.id, item]))
  return items.flatMap((item) => {
    if (!remaining.has(item.id)) return []
    return [
      (exclusiveById?.get(item.id) ?? [item]).flatMap(({ id }) => {
        const member = remaining.get(id)
        remaining.delete(id)
        return member ?? []
      }),
    ]
  })
}

export function filterAchievements(
  items: Achievement[],
  filters: Filters,
  stagesById = getAchievementStages(items),
  hiddenCompletedIds?: ReadonlySet<number>,
  exclusiveById?: ExclusiveAchievements,
): Achievement[] {
  const query = filters.query.trim().toLocaleLowerCase()
  function matchesQuery(item: Achievement) {
    if (item.id.toString() === query) return true
    const translated = item.texts[filters.language]
    const searchable =
      `${plainText(translated?.title)} ${plainText(translated?.description)} ${plainText(item.texts['zh-Hans']?.title)} ${plainText(item.texts['zh-Hans']?.description)}`.toLocaleLowerCase()
    return searchable.includes(query)
  }
  function matchesFilters(item: Achievement) {
    if (filters.category != null && item.categoryId !== filters.category) return false
    if (filters.group !== null && item.groupId !== filters.group) return false
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
    return (
      !query ||
      (exclusiveById?.has(item.id)
        ? matchesQuery(item)
        : (stagesById.get(item.id) ?? [item]).some(matchesQuery))
    )
  }
  const eligible = items.filter((item) => item.inMainMenu && !exclusionReason(item))
  const matches = getAchievementUnits(eligible, exclusiveById)
    .filter(
      (members) =>
        !(
          filters.hideCompleted &&
          members.some((item) => hiddenCompletedIds?.has(item.id) ?? isFinished(item))
        ) && members.some(matchesFilters),
    )
    .flat()
    .sort((a, b) =>
      filters.sort === 'reward'
        ? b.astrite - a.astrite || a.id - b.id
        : filters.sort === 'progress'
          ? progressRatio(b) - progressRatio(a) || a.id - b.id
          : a.id - b.id,
    )
  const remaining = new Set(matches.map((item) => item.id))
  return matches.flatMap((item) => {
    if (!remaining.has(item.id)) return []
    const members =
      exclusiveById?.get(item.id) ??
      (stagesById.get(item.id) ?? [item]).filter((stage) => !exclusiveById?.has(stage.id))
    return members.filter((member) => remaining.delete(member.id))
  })
}

export function summarize(items: Achievement[], exclusiveById?: ExclusiveAchievements) {
  const units = getAchievementUnits(
    items.filter((item) => !exclusionReason(item)),
    exclusiveById,
  )
  const summary = {
    total: units.length,
    finished: 0,
    hidden: 0,
    completedAstrite: 0,
    incompleteAstrite: 0,
    unknownAstrite: 0,
    unknown: 0,
    astrite: 0,
  }
  for (const members of units) {
    const completed = members.filter(isFinished)
    const reward = Math.max(...(completed.length ? completed : members).map((item) => item.astrite))
    summary.astrite += reward
    if (members.some((item) => item.hidden)) summary.hidden++
    if (completed.length) {
      summary.finished++
      summary.completedAstrite += reward
    } else if (members.some((item) => item.status === 'in_progress')) {
      summary.incompleteAstrite += reward
    } else {
      summary.unknown++
      summary.unknownAstrite += reward
    }
  }
  return summary
}
