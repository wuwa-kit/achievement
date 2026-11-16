import { readFile } from 'node:fs/promises'
import { readExport } from '../src/lib/data.ts'

type Texts = Record<string, { title: string | null; description?: string | null }>
interface Item {
  id: number
  groupId: number
  categoryId: number
  inMainMenu: boolean
  hidden: boolean
  nextLink: number
  titleKey: string
  descriptionKey: string
  level: number
  astrite: number
  rewards: { itemId: number; quantity: number }[]
  texts: Texts
}
interface Catalog {
  collectedAt: string
  languages: string[]
  languageCoverage: unknown[]
  categories: { id: number; inMainMenu: boolean; texts: Texts }[]
  groups: { id: number; categoryId: number; sort: number; enabled: boolean; texts: Texts }[]
  achievements: Item[]
}
export async function publicPreview() {
  const c: Catalog = JSON.parse(
    await readFile(new URL('../../data/achievement-catalog.json', import.meta.url), 'utf8'),
  )
  const previous = new Map<number, number>()
  for (const { id, nextLink } of c.achievements)
    if (nextLink > 0 && !previous.has(nextLink)) previous.set(nextLink, id)
  const achievements = c.achievements.map((a) => ({
    id: a.id,
    groupId: a.groupId,
    categoryId: a.categoryId,
    inMainMenu: a.inMainMenu,
    hidden: a.hidden,
    titleKey: a.titleKey,
    descriptionKey: a.descriptionKey,
    level: a.level,
    astrite: a.astrite,
    rewards: a.rewards,
    texts: a.texts,
    previousId: previous.get(a.id) ?? -1,
    nextId: a.nextLink,
    visibleForAccount: false,
    visibilityReason: 'catalog-preview',
    clientState: 'unknown',
    currentProgress: null,
    maxProgress: null,
    hasGetReward: null,
    finishTimeRaw: null,
    status: 'unknown',
    progressSource: 'catalog-only',
  }))
  const preview = {
    schemaVersion: 2,
    complete: true,
    preview: true,
    capturedAt: c.collectedAt,
    count: achievements.length,
    completedCount: 0,
    starCount: 0,
    mainMenuCount: achievements.filter((a) => a.inMainMenu).length,
    otherGameplayCount: achievements.filter((a) => !a.inMainMenu).length,
    languages: c.languages,
    languageCoverage: c.languageCoverage,
    categories: c.categories
      .filter((c) => c.inMainMenu)
      .map((category) => ({
        id: category.id,
        texts: category.texts,
        groups: c.groups
          .filter((g) => g.categoryId === category.id)
          .map((g) => ({
            id: g.id,
            categoryId: g.categoryId,
            sort: g.sort,
            enabled: g.enabled,
            texts: g.texts,
            unlocked: false,
            achievementIds: achievements.filter((a) => a.groupId === g.id).map((a) => a.id),
          })),
      })),
    achievements,
  }
  readExport(preview)
  return JSON.stringify(preview)
}
