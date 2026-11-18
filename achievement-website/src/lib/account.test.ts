import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  editAchievement,
  filterAchievements,
  getExclusiveAchievements,
  isFinished,
  parseExport,
  readExport,
  exportPayload,
  summarize,
  type Filters,
} from './data.ts'
import { accountSchema } from './account.ts'
import { publicPreview } from '../../build/public-catalog.ts'
import { catalogPng } from '../../build/catalog-png.ts'
import { readCatalogPng } from './catalog-png.ts'
import { missingLocalFixtures, readLocalFixtureJson } from '../../test/local-fixtures.ts'

const catalog = readExport(
  await readCatalogPng(Uint8Array.from(catalogPng(await publicPreview())).buffer),
)
const parseCompact = (input: unknown) => parseExport(input, catalog)

test('exclusive options stay adjacent through sorting, searching, and filtering', () => {
  const ids = [200710, 200711]
  const first = catalog.achievements.find((item) => item.id === ids[0])!
  const second = {
    ...catalog.achievements.find((item) => item.id === ids[1])!,
    astrite: 10,
    visibleForAccount: true,
    status: 'completed' as const,
  }
  const unrelated = {
    ...catalog.achievements.find((item) => item.id === 200712)!,
    astrite: 7,
    hidden: true,
  }
  const items = [second, unrelated, first]
  const groups = getExclusiveAchievements(items, [ids])
  const filter = (patch: Partial<Filters> = {}) =>
    filterAchievements(
      items,
      { group: null, language: 'zh-Hans', query: '', ...patch },
      undefined,
      undefined,
      groups,
    ).map((item) => item.id)

  assert.deepEqual(filter({ sort: 'reward' }), [...ids, unrelated.id])
  assert.deepEqual(filter({ query: '20071' }), [])
  assert.deepEqual(filter({ query: ' 200711 ', visibility: 'visible' }), ids)
  assert.deepEqual(filter({ query: '独自凝望的星海' }), ids)
  assert.deepEqual(filter({ status: 'finished' }), ids)
  assert.deepEqual(filter({ hideCompleted: true }), [unrelated.id])
  const summary = summarize(items, groups)
  assert.equal(summary.total, 2)
  assert.equal(summary.finished, 1)
  assert.equal(summary.hidden, 2)
  assert.equal(summary.astrite, 17)
})

test('switching an exclusive option updates a compact archive together', () => {
  const ids = [200710, 200711]
  const data = parseCompact({
    schemaVersion: 3,
    kind: 'account-progress',
    complete: true,
    uid: null,
    capturedAt: '2020-01-02T00:00:00Z',
    resourceFingerprint: 'test',
    count: 1,
    completedCount: 1,
    starCount: 5,
    groupStates: [{ id: 2007, unlocked: true }],
    achievements: [
      {
        id: ids[0],
        previousId: -1,
        nextId: -1,
        currentProgress: 1,
        maxProgress: 1,
        hasGetReward: true,
        finishTimeRaw: null,
      },
    ],
  })
  assert.equal(editAchievement(data, ids[1], true, catalog, { ids, replace: false }), data)
  const switched = editAchievement(data, ids[1], true, catalog, { ids, replace: true })
  const snapshot = accountSchema.parse(exportPayload(switched))
  assert.equal(snapshot.completedCount, 1)
  assert.equal(snapshot.starCount, 5)
  assert.deepEqual(
    snapshot.achievements.map(({ id, currentProgress }) => [id, currentProgress]),
    [
      [ids[1], 1],
      [ids[0], 0],
    ],
  )
  assert.deepEqual(
    parseCompact(snapshot)
      .achievements.filter((item) => ids.includes(item.id) && isFinished(item))
      .map((item) => item.id),
    [ids[1]],
  )
})

const snapshotFile = 'session-24624/achievement-snapshot.json'
const archiveFile = 'achievements.json'
const skipWithoutSnapshot = { skip: missingLocalFixtures(snapshotFile) }

function readAccount() {
  const snapshot = readLocalFixtureJson(snapshotFile)
  return {
    schemaVersion: 3,
    kind: 'account-progress',
    complete: true,
    uid: '10001',
    capturedAt: snapshot.at,
    resourceFingerprint: 'test',
    count: snapshot.count,
    completedCount: snapshot.modelFinishCount,
    starCount: snapshot.modelStarCount,
    achievements: snapshot.achievements,
    groupStates: snapshot.groupStates,
  }
}

test(
  'compact account merges static resources with parity to legacy export',
  { skip: missingLocalFixtures(snapshotFile, archiveFile) },
  () => {
    const account = readAccount()
    const merged = parseCompact(account)
    const legacy = parseExport(readLocalFixtureJson(archiveFile))
    assert.equal(merged.uid, '10001')
    assert.deepEqual(summarize(merged.achievements), summarize(legacy.achievements))
    for (const item of merged.achievements) {
      const old = legacy.achievements.find((a) => a.id === item.id)!
      for (const key of [
        'status',
        'currentProgress',
        'maxProgress',
        'texts',
        'astrite',
        'hidden',
        'visibleForAccount',
      ])
        assert.deepEqual(item[key], old[key], `${item.id}: ${key}`)
    }
    assert.deepEqual(exportPayload(merged), account)
    assert.deepEqual(parseCompact(exportPayload(merged)), merged)
  },
)

test(
  'absent progress is unknown, excluded IDs stay filtered and new IDs survive export',
  skipWithoutSnapshot,
  () => {
    const account = readAccount()
    const future = {
      ...account,
      achievements: account.achievements.filter((a: { id: number }) => a.id !== 100101),
    }
    future.achievements.push({
      id: 999999,
      previousId: -1,
      nextId: -1,
      currentProgress: 0,
      maxProgress: 1,
      hasGetReward: false,
      finishTimeRaw: 0,
    })
    const merged = parseCompact(future)
    assert.equal(merged.achievements.find((a) => a.id === 100101)!.status, 'unknown')
    assert.ok(!merged.achievements.some((a) => [201196, 400205, 999999].includes(a.id)))
    assert.deepEqual(merged.unknownCatalogIds, [999999])
    const raw = accountSchema.parse(exportPayload(merged))
    assert.ok(raw.achievements.some((a) => a.id === 999999))
    assert.ok(raw.achievements.some((a) => a.id === 201196))
  },
)

test(
  'compact validation rejects duplicate IDs, incomplete captures and bad progress',
  skipWithoutSnapshot,
  () => {
    const account = readAccount()
    assert.throws(() => parseCompact({ ...account, complete: false }))
    assert.throws(() => parseCompact({ ...account, count: 1 }))
    assert.throws(() =>
      parseCompact({
        ...account,
        achievements: account.achievements.map(() => account.achievements[0]),
      }),
    )
    assert.throws(() =>
      parseCompact({ ...account, groupStates: [account.groupStates[0], account.groupStates[0]] }),
    )
    assert.throws(() =>
      parseCompact({
        ...account,
        achievements: [
          { ...account.achievements[0], currentProgress: -1 },
          ...account.achievements.slice(1),
        ],
      }),
    )
  },
)

test(
  'editing compact progress updates its timestamp and preserves unrecognized IDs',
  skipWithoutSnapshot,
  () => {
    const account = readAccount()
    const input = {
      ...account,
      count: account.count + 1,
      achievements: [...account.achievements, { ...account.achievements[0], id: 999999 }],
    }
    const data = parseCompact(input)
    const item = data.achievements.find((entry) => !isFinished(entry))!
    const edited = editAchievement(data, item.id, true, catalog)
    const payload = accountSchema.parse(exportPayload(edited))
    assert.ok(Date.parse(payload.capturedAt) > Date.parse(data.capturedAt))
    assert.equal(payload.achievements.length, input.achievements.length)
    assert.ok(payload.achievements.some((entry) => entry.id === 999999))
    assert.equal(
      parseCompact(payload).achievements.find((entry) => entry.id === item.id)?.status,
      'completed',
    )
  },
)
