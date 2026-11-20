import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  editAchievement,
  filterAchievements,
  getAchievementStages,
  isFinished,
  parseExport,
  plainText,
  progressRatio,
  summarize,
} from './data.ts'
import { exclusionReason } from './exclusions.ts'
import type { Filters } from './data.ts'
import { missingLocalFixtures, readLocalFixtureJson } from '../../test/local-fixtures.ts'
import { publicPreview } from '../../build/public-catalog.ts'

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

test('search matches complete IDs alongside numeric title and description text', async () => {
  const catalog = parseExport(JSON.parse(await publicPreview()))
  const base = catalog.achievements.find((item) => item.id === 100101)!
  const makeItem = (id: number, title: string, description: string, englishTitle: string) => ({
    ...base,
    id,
    previousId: -1,
    nextId: -1,
    texts: {
      'zh-Hans': { title, description },
      en: { title: englishTitle, description: '' },
    },
  })
  const items = [
    makeItem(100101, '普通成就', '完成任务', 'Ordinary achievement'),
    makeItem(200001, '挑战100次', '完成挑战', 'Challenge'),
    makeItem(200002, '伤害成就', '累计造成1000点伤害', 'Deal 1000 damage'),
    makeItem(200003, '记录成就', '累计100101条记录', 'Records'),
  ]
  const search = (query: string, language = 'zh-Hans') =>
    filterAchievements(items, { ...filters, query, language }).map((item) => item.id)

  assert.deepEqual(search('100'), [200001, 200002, 200003])
  assert.deepEqual(search(' 100101 '), [100101, 200003])
  assert.deepEqual(search('10010'), [200003])
  assert.deepEqual(search('挑战100'), [200001])
  assert.deepEqual(search('100', 'en'), [200001, 200002, 200003])
  assert.deepEqual(search('DEAL 1000', 'en'), [200002])
})

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
      total: 1304,
      finished: 55,
      hidden: 267,
      completedAstrite: 450,
      incompleteAstrite: 8345,
      unknownAstrite: 0,
      unknown: 0,
      astrite: 8795,
    })
    assert.equal(data.achievements.length, 1304)
    assert.equal(data.otherGameplayCount, 0)
    assert.ok(data.achievements.every((a) => a.inMainMenu))
  },
)
test('visibility, hidden state and completion remain separate filters', skipWithoutExport, () => {
  const data = readExport()
  assert.equal(
    filterAchievements(data.achievements, { ...filters, visibility: 'hidden' }).length,
    267,
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

test('manual stage edits complete predecessors and cancel successors with accurate totals', async () => {
  const data = parseExport(JSON.parse(await publicPreview()))
  const ids = [100402, 100403, 100411]
  const stages = getAchievementStages(data.achievements).get(ids[1])!
  const states = (value: typeof data) =>
    ids.map((id) => isFinished(value.achievements.find((item) => item.id === id)!))

  const middle = editAchievement(data, ids[1], true)
  assert.deepEqual(states(middle), [true, true, false])
  assert.equal(middle.completedCount, data.completedCount + 2)
  assert.equal(middle.starCount, data.starCount + stages[0].astrite + stages[1].astrite)
  assert.equal(editAchievement(middle, ids[1], true), middle)
  assert.equal(
    middle.achievements.find((item) => item.id === ids[2]),
    stages[2],
  )

  const last = editAchievement(middle, ids[2], true)
  assert.deepEqual(states(last), [true, true, true])
  assert.equal(last.completedCount, data.completedCount + 3)
  assert.equal(last.starCount, data.starCount + stages.reduce((sum, item) => sum + item.astrite, 0))
  assert.equal(
    last.achievements.find((item) => item.id === ids[0]),
    middle.achievements.find((item) => item.id === ids[0]),
  )
  const directLast = editAchievement(data, ids[2], true)
  assert.deepEqual(states(directLast), [true, true, true])

  const reverted = editAchievement(last, ids[1], false)
  assert.deepEqual(states(reverted), [true, false, false])
  assert.equal(reverted.completedCount, data.completedCount + 1)
  assert.equal(reverted.starCount, data.starCount + stages[0].astrite)
  for (const id of ids.slice(1)) {
    const item = reverted.achievements.find((item) => item.id === id)!
    assert.equal(item.currentProgress, 0)
    assert.equal(item.finishTimeRaw, null)
  }
  const cleared = editAchievement(reverted, ids[0], false)
  assert.deepEqual(states(cleared), [false, false, false])
  assert.equal(cleared.completedCount, data.completedCount)
  assert.equal(cleared.starCount, data.starCount)
  assert.equal(editAchievement(cleared, ids[0], false), cleared)
  assert.equal(
    cleared.achievements.find((item) => item.id === 100101),
    data.achievements.find((item) => item.id === 100101),
  )
})
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
    assert.equal(current.count, 1304)
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
