import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  editAchievement,
  filterAchievements,
  getAchievementStages,
  isStageWaiting,
  parseExport,
  plainText,
  progressRatio,
  summarize,
} from './data.ts'
import { exclusionReason } from './exclusions.ts'
import type { Filters } from './data.ts'
import { missingLocalFixtures, readLocalFixtureJson } from '../../test/local-fixtures.ts'

const exportFile = 'achievements.json'
const legacyFile = 'csharp-live/achievements.json'
const skipWithoutExport = { skip: missingLocalFixtures(exportFile) }
const skipWithoutBoth = { skip: missingLocalFixtures(exportFile, legacyFile) }
let cachedExport: ReturnType<typeof parseExport> | undefined
const readExport = () => (cachedExport ??= parseExport(readLocalFixtureJson(exportFile)))
const readLegacy = () => readLocalFixtureJson(legacyFile)
const filters: Filters = {
  query: '',
  language: 'zh-Hans',
  category: null,
  group: null,
  status: 'all',
  visibility: 'all',
  sort: 'id',
}

test(
  'real export retains the main hierarchy, hidden records and precise rewards',
  skipWithoutExport,
  () => {
    const data = readExport()
    const main = filterAchievements(data.achievements, filters)
    assert.equal(main.length, data.mainMenuCount)
    assert.equal(data.categories.length, 4)
    assert.equal(data.categories.flatMap((c) => c.groups).length, 36)
    assert.deepEqual(summarize(main), {
      total: 1305,
      finished: 55,
      hidden: 268,
      completedAstrite: 450,
      incompleteAstrite: 8350,
      unknownAstrite: 0,
      unknown: 0,
      astrite: 8800,
    })
    assert.equal(data.achievements.length, 1305)
    assert.equal(data.otherGameplayCount, 0)
    assert.ok(data.achievements.every((a) => a.inMainMenu))
  },
)
test('visibility, hidden state and completion remain separate filters', skipWithoutExport, () => {
  const data = readExport()
  assert.equal(
    filterAchievements(data.achievements, { ...filters, visibility: 'hidden' }).length,
    268,
  )
  assert.equal(
    filterAchievements(data.achievements, { ...filters, visibility: 'visible' }).length,
    999,
  )
  assert.equal(filterAchievements(data.achievements, { ...filters, status: 'finished' }).length, 55)
  assert.equal(
    filterAchievements(data.achievements, { ...filters, query: '400205', status: 'unknown' })[0]
      ?.id,
    undefined,
  )
  assert.equal(
    filterAchievements(data.achievements, { ...filters, language: 'en', query: 'POWER!' })[0]?.id,
    100101,
  )
})
test(
  'linked stages stay adjacent and searches keep matching chains in stage order',
  skipWithoutExport,
  () => {
    const data = readExport()
    const ids = [100402, 100403, 100411]
    const matches = filterAchievements(data.achievements, filters).map((item) => item.id)
    assert.deepEqual(matches.slice(matches.indexOf(ids[0]), matches.indexOf(ids[0]) + 3), ids)
    assert.deepEqual(
      filterAchievements(data.achievements, { ...filters, query: '100411' }).map((item) => item.id),
      ids,
    )
    const edited = editAchievement(data, ids[0], true)
    assert.deepEqual(
      filterAchievements(edited.achievements, {
        ...filters,
        query: '100402',
        hideCompleted: true,
      }).map((item) => item.id),
      ids.slice(1),
    )
  },
)

test(
  'manual completion waits for the previous stage, while imported completion is retained',
  skipWithoutExport,
  () => {
    const data = readExport()
    const first = 100402
    const second = 100403
    assert.equal(editAchievement(data, second, true), data)
    const edited = editAchievement(editAchievement(data, first, true), second, true)
    const reverted = editAchievement(edited, first, false)
    const stages = getAchievementStages(reverted.achievements).get(second)!
    assert.equal(stages[1].status, 'completed')
    assert.equal(isStageWaiting(stages[1], stages), false)
    assert.equal(isStageWaiting(stages[2], stages), false)
  },
)
test('unknown progress and missing translations are never fabricated', skipWithoutBoth, () => {
  const data = readExport()
  const legacy = readLegacy()
  const unknown = (legacy.achievements as typeof data.achievements).find((a) => a.id === 400205)!
  assert.equal(progressRatio(unknown), 0)
  assert.equal(unknown.currentProgress, null)
  assert.equal(data.achievements[0].texts.ru.title, null)
  assert.equal(plainText('<color=#ffeeee>文字</>'), '文字')
  assert.equal(plainText('<script>alert(1)</script>'), '<script>alert(1)</script>')
})
test(
  'invalid imports reject duplicate IDs, broken hierarchy and old schemas',
  skipWithoutExport,
  () => {
    const data = readExport()
    assert.throws(() => parseExport({ ...data, schemaVersion: 1 }))
    assert.throws(() =>
      parseExport({
        ...data,
        achievements: [data.achievements[0], ...data.achievements.slice(0, -1)],
      }),
    )
    assert.throws(() => parseExport({ ...data, categories: [] }))
  },
)

test(
  'legacy full exports are narrowed to main achievements',
  { skip: missingLocalFixtures(legacyFile) },
  () => {
    const legacy = readLegacy()
    assert.equal(legacy.count, 1408)
    const current = parseExport(legacy)
    assert.equal(current.count, 1305)
    assert.equal(current.otherGameplayCount, 0)
    assert.equal(current.completedCount, 55)
    assert.equal(current.starCount, 87)
    assert.ok(current.achievements.every((a) => a.inMainMenu))
  },
)

test(
  'claiming rewards does not change completion filters or reward totals',
  skipWithoutExport,
  () => {
    const data = readExport()
    const claimed = data.achievements.map((a) =>
      a.status === 'completed'
        ? { ...a, status: 'reward_claimed' as const, hasGetReward: true }
        : a,
    )
    assert.deepEqual(summarize(claimed), summarize(data.achievements))
    assert.deepEqual(
      filterAchievements(claimed, { ...filters, status: 'finished' }).map((a) => a.id),
      filterAchievements(data.achievements, { ...filters, status: 'finished' }).map((a) => a.id),
    )
    const summary = summarize(data.achievements)
    assert.equal(
      summary.completedAstrite + summary.incompleteAstrite + summary.unknownAstrite,
      summary.astrite,
    )
  },
)

test(
  'the missing-progress exclusion applies to its configured ID until new evidence arrives',
  skipWithoutBoth,
  () => {
    const data = readExport()
    const legacy = readLegacy()
    const item = (legacy.achievements as typeof data.achievements).find((a) => a.id === 400205)!
    assert.ok(exclusionReason(item))
    assert.equal(exclusionReason({ ...item, id: 999999 }), null)
    assert.equal(exclusionReason({ ...item, currentProgress: 0, maxProgress: 1 }), null)
    assert.equal(exclusionReason({ ...item, status: 'completed', finishTimeRaw: 123 }), null)
    assert.equal(exclusionReason({ ...item, visibleForAccount: true }), null)
    assert.equal(
      filterAchievements(
        [{ ...item, currentProgress: 0, maxProgress: 1, status: 'in_progress' }],
        filters,
      ).length,
      1,
    )
    assert.equal(summarize([{ ...item, id: 999999 }]).unknown, 1)
    assert.equal(
      data.achievements.some((a) => a.id === 400205),
      false,
    )
  },
)

test(
  'the title-based exclusion removes 201196 from old archives, hierarchy and totals',
  skipWithoutBoth,
  () => {
    const data = readExport()
    const legacy = readLegacy()
    const item = (legacy.achievements as typeof data.achievements).find((a) => a.id === 201196)!
    assert.ok(exclusionReason(item))
    assert.equal(filterAchievements([item], filters).length, 0)
    assert.equal(summarize([item]).astrite, 0)
    assert.ok(!data.achievements.some((a) => a.id === item.id))
    assert.ok(
      data.categories.every((c) => c.groups.every((g) => !g.achievementIds.includes(item.id))),
    )
    assert.equal(exclusionReason({ ...item, id: 999999 }), null)
    const restored = { ...item, texts: { ...item.texts, 'zh-Hans': { title: '正式成就' } } }
    assert.equal(exclusionReason(restored), null)
    assert.equal(filterAchievements([restored], filters).length, 1)
    assert.deepEqual(parseExport(data), data)
  },
)
