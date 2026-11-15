import { selectValue, expectOptions } from './select-helpers'
import { expect, test } from '@playwright/test'
import { spawn } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

test('real HTTP handoff persists before acknowledgement and survives refresh', async ({
  page,
}, info) => {
  const executable = fileURLToPath(
    new URL(
      '../../achievement-export/artifacts/transfer-tests/Wuwa.Transfer.Tests.exe',
      import.meta.url,
    ),
  )
  const fixture = fileURLToPath(new URL('../../fixtures/local/achievements.json', import.meta.url))
  const ticketFile = info.outputPath('ticket.txt')
  const child = spawn(executable, ['serve', fixture, ticketFile], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  child.stdout.on('data', (data) => {
    output += String(data)
  })
  child.stderr.on('data', (data) => {
    output += String(data)
  })
  try {
    let url = ''
    await expect
      .poll(async () => {
        try {
          url = await readFile(ticketFile, 'utf8')
          return url.startsWith('http://')
        } catch {
          return false
        }
      })
      .toBe(true)
    await page.goto('/')
    await expect(page.getByTestId('completed-astrite')).toHaveText('0')
    await expect(page.locator('.nav-overview .nav-count')).toHaveText('0/1305')
    // Desktop can reuse an existing tab: a fragment-only navigation must be handled.
    await page.goto(url)
    const dialog = page.getByTestId('desktop-import-dialog')
    await expect(dialog).toBeVisible()
    expect(new URL(page.url()).hash).toBe('')
    await dialog.getByTestId('cancel-desktop-import').click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.nav-overview .nav-count')).toHaveText('0/1305')
    expect(output).not.toContain('Received')
    await page.goto(url)
    // Lost acknowledgement must preserve the saved data and permit retry without refetching.
    await page.route('**/v1/ack', (route) => route.abort(), { times: 1 })
    await dialog.getByTestId('confirm-desktop-import').click()
    await expect(dialog).toHaveCount(0)
    await expect(page.locator('.w-message[data-type="success"]')).toHaveText(
      '成就档案已导入并保存到此浏览器',
    )
    await expect(
      page.getByText('档案已保存，桌面确认未完成，可重试确认', { exact: true }),
    ).toBeVisible()
    expect(output).not.toContain('Received')
    await page.route('**/v1/export', (route) => route.abort())
    const retry = page.getByText('重试确认', { exact: true })
    await retry.click()
    await expect.poll(() => output).toContain('Received')
    await expect(retry).toHaveCount(0)
    await expect(page.getByTestId('completed-astrite')).toHaveText('450')
    await expect(page.locator('.nav-overview .nav-count')).toHaveText('55/1305')
    await page.reload()
    await expect(page.getByTestId('completed-astrite')).toHaveText('450')
    await expect(page.locator('.nav-overview .nav-count')).toHaveText('55/1305')
    await page.getByTestId('隐藏已完成').click()
    await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1250')
    await page.screenshot({ path: info.outputPath('received.png'), fullPage: false })
  } finally {
    child.kill()
  }
})

test('public preview has no account progress and malformed ticket is cleared', async ({ page }) => {
  const response = await page.request.get('/data/achievements.json')
  const data = await response.json()
  expect(data.preview).toBe(true)
  expect(data.achievements).toHaveLength(1305)
  expect(
    data.achievements.every(
      (a: { status: string; currentProgress: unknown; hasGetReward: unknown }) =>
        a.status === 'unknown' && a.currentProgress === null && a.hasGetReward === null,
    ),
  ).toBe(true)
  await page.goto('/#handoff=v1&port=99999&key=wrong')
  await expect(page.getByText('接收链接无效，请从桌面程序重新发送', { exact: true })).toBeVisible()
  expect(new URL(page.url()).hash).toBe('')
})

test('late catalog response cannot replace an imported account', async ({ page }) => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/data/achievements.json', async (route) => {
    await pending
    await route.continue()
  })
  try {
    await page.goto('/')
    await page
      .getByTestId('导入成就 JSON 文件')
      .setInputFiles(
        fileURLToPath(new URL('../../fixtures/local/achievements.json', import.meta.url)),
      )
    await expect(page.locator('.w-message[data-type="success"]')).toHaveText(
      '成就档案已导入并保存到此浏览器',
    )
    await expect(page.getByTestId('completed-astrite')).toHaveText('450')
    const response = page.waitForResponse('**/data/achievements.json')
    release()
    await response
    await expect(page.getByTestId('completed-astrite')).toHaveText('450')
    await expect(page.locator('.nav-overview .nav-count')).toHaveText('55/1305')
  } finally {
    release()
  }
})

test('sequential v3 desktop handoffs select the new UID and download its data', async ({
  page,
}, info) => {
  const executable = fileURLToPath(
    new URL(
      '../../achievement-export/artifacts/transfer-tests/Wuwa.Transfer.Tests.exe',
      import.meta.url,
    ),
  )
  async function readAccount(file: string, uid: string) {
    const snapshot = JSON.parse(
      (await readFile(new URL('../../fixtures/local/' + file, import.meta.url), 'utf8')).replace(
        /^\uFEFF/,
        '',
      ),
    )
    return {
      schemaVersion: 3,
      kind: 'account-progress',
      complete: true,
      uid,
      capturedAt: snapshot.at,
      resourceFingerprint: 'test',
      count: snapshot.count,
      completedCount: snapshot.modelFinishCount,
      starCount: snapshot.modelStarCount,
      achievements: snapshot.achievements,
      groupStates: snapshot.groupStates,
    }
  }
  const [accountA, accountB] = await Promise.all([
    readAccount('session-24624/achievement-snapshot.json', '10001'),
    readAccount('csharp-session-10324-20261114-071240/attempt-8-second.json', '10002'),
  ])
  await page.goto('/')
  for (const [index, payload] of [accountA, accountB, accountB].entries()) {
    const file = info.outputPath('account-' + index + '.json')
    const ticket = info.outputPath('ticket-' + index + '.txt')
    await writeFile(file, JSON.stringify(payload))
    const child = spawn(executable, ['serve', file, ticket], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    try {
      let url = ''
      await expect
        .poll(async () => {
          try {
            url = await readFile(ticket, 'utf8')
            return url.startsWith('http://')
          } catch {
            return false
          }
        })
        .toBe(true)
      await page.goto(url)
      await page.getByTestId('confirm-desktop-import').click()
      await expect.poll(() => output).toContain('Received')
      await expect(page.getByTestId('账号档案')).toHaveAttribute('data-value', 'uid:' + payload.uid)
      await expect(page.locator('.nav-overview .nav-count')).toHaveText(
        `${payload.completedCount}/1305`,
      )
      await expectOptions(page, '账号档案', index === 0 ? 2 : 3)
    } finally {
      child.kill()
    }
  }
  await page.reload()
  await expect(page.getByTestId('账号档案')).toHaveAttribute('data-value', 'uid:10002')
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('1200/1305')
  const downloaded = page.waitForEvent('download')
  await page.getByTestId('档案更多操作').click()
  await page.getByTestId('export-achievement-file').click()
  const download = await downloaded
  const payload = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(payload).toEqual(accountB)
  await selectValue(page, page.getByTestId('账号档案'), 'uid:10001')
  await expect(page.locator('.nav-overview .nav-count')).toHaveText(
    `${accountA.completedCount}/1305`,
  )
})
