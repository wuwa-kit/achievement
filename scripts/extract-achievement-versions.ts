import { readFile, writeFile } from 'node:fs/promises'
import { z } from 'zod'

const sourceUrl = 'https://mc.appfeng.com/json/achievement.json'
const output = new URL('../data/achievement-versions.json', import.meta.url)
const versionPattern = /^\d+\.\d+(?:\.\d+)?$/
const id = z.number().int().positive()
const sourceSchema = z.array(
  z.object({
    list: z.array(
      z.object({ id, since: z.string().regex(versionPattern), also: z.array(id).optional() }),
    ),
  }),
)

const inputPath = process.argv[2]
const input = inputPath ? await readFile(inputPath, 'utf8') : await fetchSource()
const groups = sourceSchema.parse(JSON.parse(input))
const idsByVersion = new Map<string, Set<number>>()
for (const { list } of groups) {
  for (const { id, since, also = [] } of list) {
    let ids = idsByVersion.get(since)
    if (!ids) idsByVersion.set(since, (ids = new Set()))
    ids.add(id)
    // The viewer catalog may retain a different ID for the same achievement.
    for (const alias of also) ids.add(alias)
  }
}
if (!idsByVersion.size) throw new Error('The source contains no versioned achievements')

const versions = [...idsByVersion].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
const versionData = Object.fromEntries(
  versions.map(([version, ids]) => [version, [...ids].sort((a, b) => a - b)]),
)
await writeFile(output, JSON.stringify(versionData, null, 2) + '\n')

async function fetchSource() {
  const response = await fetch(sourceUrl)
  if (!response.ok)
    throw new Error(`Failed to fetch achievement versions (HTTP ${response.status})`)
  return response.text()
}
