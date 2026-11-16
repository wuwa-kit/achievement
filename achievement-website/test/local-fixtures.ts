import { readFileSync, statSync } from 'node:fs'

export function localFixture(file: string) {
  return new URL(`../../fixtures/local/${file}`, import.meta.url)
}

export function missingLocalFixtures(...files: string[]) {
  const missing = files.filter((file) => !statSync(localFixture(file), { throwIfNoEntry: false }))
  if (missing.length) {
    return `Local fixture files not found: ${missing.map((file) => `fixtures/local/${file}`).join(', ')}`
  }
}

export function readLocalFixtureJson(file: string) {
  return JSON.parse(readFileSync(localFixture(file), 'utf8').replace(/^\uFEFF/, ''))
}
