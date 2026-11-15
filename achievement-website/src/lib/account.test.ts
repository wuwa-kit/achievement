import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { editAchievement, isFinished, parseExport, exportPayload, summarize } from './data.ts'
import { accountSchema } from './account.ts'

const read = (file: string) =>
  JSON.parse(
    readFileSync(new URL('../../../fixtures/local/' + file, import.meta.url), 'utf8').replace(
      /^\uFEFF/,
      '',
    ),
  )
const snapshot = read('session-24624/achievement-snapshot.json')
const account = {
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

test('compact account merges static resources with parity to legacy export', () => {
  const merged = parseExport(account)
  const legacy = parseExport(read('achievements.json'))
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
  assert.deepEqual(parseExport(exportPayload(merged)), merged)
})

test('absent progress is unknown, excluded IDs stay filtered and new IDs survive export', () => {
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
  const merged = parseExport(future)
  assert.equal(merged.achievements.find((a) => a.id === 100101)!.status, 'unknown')
  assert.ok(!merged.achievements.some((a) => [201196, 400205, 999999].includes(a.id)))
  assert.deepEqual(merged.unknownCatalogIds, [999999])
  const raw = accountSchema.parse(exportPayload(merged))
  assert.ok(raw.achievements.some((a) => a.id === 999999))
  assert.ok(raw.achievements.some((a) => a.id === 201196))
})

test('compact validation rejects duplicate IDs, incomplete captures and bad progress', () => {
  assert.throws(() => parseExport({ ...account, complete: false }))
  assert.throws(() => parseExport({ ...account, count: 1 }))
  assert.throws(() =>
    parseExport({
      ...account,
      achievements: account.achievements.map(() => account.achievements[0]),
    }),
  )
  assert.throws(() =>
    parseExport({ ...account, groupStates: [account.groupStates[0], account.groupStates[0]] }),
  )
  assert.throws(() =>
    parseExport({
      ...account,
      achievements: [
        { ...account.achievements[0], currentProgress: -1 },
        ...account.achievements.slice(1),
      ],
    }),
  )
})

test('editing compact progress updates its timestamp and preserves unrecognized IDs', () => {
  const input = {
    ...account,
    count: account.count + 1,
    achievements: [...account.achievements, { ...account.achievements[0], id: 999999 }],
  }
  const data = parseExport(input)
  const item = data.achievements.find((entry) => !isFinished(entry))!
  const edited = editAchievement(data, item.id, true)
  const payload = accountSchema.parse(exportPayload(edited))
  assert.ok(Date.parse(payload.capturedAt) > Date.parse(data.capturedAt))
  assert.equal(payload.achievements.length, input.achievements.length)
  assert.ok(payload.achievements.some((entry) => entry.id === 999999))
  assert.equal(
    parseExport(payload).achievements.find((entry) => entry.id === item.id)?.status,
    'completed',
  )
})
