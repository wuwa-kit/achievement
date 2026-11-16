import { test } from '@playwright/test'
import { missingLocalFixtures } from '../test/local-fixtures'

export function skipIfMissingLocalFixtures(...files: string[]) {
  const reason = missingLocalFixtures(...files)
  if (reason) {
    console.warn(reason)
    test.skip(true, reason)
  }
}
