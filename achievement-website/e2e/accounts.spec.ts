import { readPreviewResponse } from './catalog-helpers'
import { selectValue, expectOptions } from './select-helpers'
import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('compact account uses the same cached PNG as the public catalog', async ({ page }) => {
  const path = '/data/achievement-catalog.png'
  const catalog = await readPreviewResponse(await page.request.get(path))
  const item = catalog.achievements.find((entry) => entry.astrite > 0)!
  let downloads = 0
  await page.route('**' + path, (route) => {
    downloads++
    return route.continue()
  })
  await page.goto('/')
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', String(catalog.count))
  await page.getByTestId('导入成就 JSON 文件').setInputFiles({
    name: 'achievements.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        schemaVersion: 3,
        kind: 'account-progress',
        complete: true,
        uid: '10001',
        capturedAt: '2020-01-02T00:00:00Z',
        resourceFingerprint: 'test',
        count: 1,
        completedCount: 1,
        starCount: item.astrite,
        groupStates: [{ id: item.groupId, unlocked: true }],
        achievements: [
          {
            id: item.id,
            previousId: item.previousId,
            nextId: item.nextId,
            currentProgress: 1,
            maxProgress: 1,
            hasGetReward: true,
            finishTimeRaw: null,
          },
        ],
      }),
    ),
  })
  await expect(page.getByTestId('completed-astrite')).toHaveText(String(item.astrite))
  await expect(page.getByTestId('账号档案')).toHaveAttribute('data-value', 'uid:10001')
  expect(downloads).toBe(1)
  await page.route('**' + path, (route) => route.abort())
  await page.reload()
  await expect(page.getByTestId('completed-astrite')).toHaveText(String(item.astrite))
})

test('UID archives replace matching accounts and anonymous imports share the default account', async ({
  page,
}) => {
  await page.goto('/')
  const data = await readPreviewResponse(await page.request.get('/data/achievement-catalog.png'))
  async function upload(uid: string | null, stars: number, capturedAt: string) {
    await page.getByTestId('导入成就 JSON 文件').setInputFiles({
      name: 'achievements.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          ...data,
          preview: false,
          uid,
          capturedAt,
          starCount: stars,
          achievements: data.achievements.map((a: object, i: number) => ({
            ...a,
            status: i === 0 ? 'completed' : 'in_progress',
            astrite: i === 0 ? stars : 0,
          })),
        }),
      ),
    })
    await expect(page.getByTestId('completed-astrite')).toHaveText(String(stars))
    await expect(page.getByTestId('旧档案导入确认')).toHaveCount(0)
  }
  await upload('10001', 11, '2020-01-02T00:00:00+08:00')
  await upload('10002', 22, '2020-01-02T00:00:00+08:00')
  await upload('10001', 33, '2020-01-01T17:00:00Z')
  await expectOptions(page, '账号档案', 3)
  await selectValue(page, page.getByTestId('账号档案'), 'uid:10002')
  await expect(page.getByTestId('completed-astrite')).toHaveText('22')
  await page.reload()
  await expect(page.getByTestId('completed-astrite')).toHaveText('22')
  await upload(null, 44, '2020-01-02T00:00:00+08:00')
  await upload(null, 55, '2020-01-01T17:00:00Z')
  await expectOptions(page, '账号档案', 3)
  await expect(page.getByTestId('账号档案')).toHaveAttribute('data-value', 'default')
})

test('legacy current archive survives migration', async ({ page }) => {
  // Seed before loading the archive app, which holds an IndexedDB connection.
  await page.goto('/desktop')
  const data = await readPreviewResponse(await page.request.get('/data/achievement-catalog.png'))
  await page.evaluate(async (data) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('wuwa-achievement-archive')
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('wuwa-achievement-archive', 1)
      request.onupgradeneeded = () => request.result.createObjectStore('exports')
      request.onsuccess = () => {
        const db = request.result
        const tx = db.transaction('exports', 'readwrite')
        tx.objectStore('exports').put(
          {
            ...data,
            preview: false,
            starCount: 66,
            achievements: data.achievements.map((a: object, i: number) => ({
              ...a,
              status: i === 0 ? 'completed' : 'in_progress',
              astrite: i === 0 ? 66 : 0,
            })),
          },
          'current',
        )
        tx.oncomplete = () => {
          db.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  }, data)
  await page.goto('/')
  await expect(page.getByTestId('completed-astrite')).toHaveText('66')
  await expectOptions(page, '账号档案', 1)
  await expect(page.getByTestId('账号档案')).not.toHaveAttribute('data-value', '')
})

test('migration keeps the newest anonymous archive as the default account', async ({ page }) => {
  await page.goto('/desktop')
  const catalog = await readPreviewResponse(await page.request.get('/data/achievement-catalog.png'))
  await page.evaluate(async (catalog) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('wuwa-achievement-archive', 2)
      request.onupgradeneeded = () => {
        const exports = request.result.createObjectStore('exports')
        const accounts = request.result.createObjectStore('accounts')
        const old = { ...catalog, capturedAt: '2020-01-01T00:00:00Z' }
        const newest = { ...catalog, capturedAt: '2021-01-01T00:00:00Z' }
        accounts.put(old, 'anonymous:old')
        accounts.put(newest, 'anonymous:new')
        exports.put(old, 'current')
        exports.put('anonymous:old', 'active')
      }
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }, catalog)
  await page.goto('/')
  const account = page.getByTestId('账号档案')
  await expect(account).toHaveAttribute('data-value', 'default')
  await expect(account).toContainText('2021')
  await expectOptions(page, '账号档案', 1)
})

test('edits advance the archive timestamp, older imports need approval, and deletion returns to default', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  const catalog = await readPreviewResponse(await page.request.get('/data/achievement-catalog.png'))
  const capturedAt = '2020-01-02T00:00:00.000Z'
  const snapshot = { ...catalog, preview: false, uid: '10001', capturedAt }
  const account = page.getByTestId('账号档案')
  const more = page.getByTestId('档案更多操作')
  async function upload() {
    await page.getByTestId('导入成就 JSON 文件').setInputFiles({
      name: 'achievements.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(snapshot)),
    })
  }
  async function editFirstAchievement(initialProgress: string) {
    await page
      .getByTestId(/^查看成就详情 /)
      .first()
      .click()
    const edit = page.getByTestId('编辑成就完成状态')
    const detail = page.getByTestId('成就详情内容')
    await expect(edit).not.toBeChecked()
    await expect(detail.getByText(initialProgress, { exact: true })).toBeVisible()
    await edit.click()
    await expect(edit).toBeChecked()
    await expect(detail.getByText('1/1', { exact: true })).toBeVisible()
    await expect(page.locator('.nav-overview .nav-count')).toHaveText('1/1297')
    await page.getByTestId('关闭详情').click()
  }

  await expect(account).toHaveAttribute('data-value', 'default')
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('0/1297')
  await editFirstAchievement('0/1')
  await upload()
  await expect(account).toHaveAttribute('data-value', 'uid:10001')
  await editFirstAchievement('—/—')
  await page.reload()
  await expect(account).toHaveAttribute('data-value', 'uid:10001')
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('1/1297')

  if (testInfo.project.name === 'mobile') await more.click()
  else await more.hover()
  const downloaded = page.waitForEvent('download')
  await page.getByTestId('export-achievement-file').click()
  const download = await downloaded
  const payload = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(Date.parse(payload.capturedAt)).toBeGreaterThan(Date.parse(capturedAt))
  const timestamp = /^Wuthering-Waves-Achievements-10001-(\d{8})-(\d{6})Z\.json$/.exec(
    download.suggestedFilename(),
  )
  expect(timestamp?.slice(1).join('')).toBe(
    new Date(payload.capturedAt).toISOString().slice(0, 19).replace(/\D/g, ''),
  )

  await upload()
  const overwritePrompt = page.getByTestId('旧档案导入确认')
  await expect(overwritePrompt).toBeVisible()
  await expect(overwritePrompt).toContainText('早于已保存的档案')
  await expect(page.getByTestId('取消导入旧档案')).toHaveText('保留本地档案')
  await expect(page.getByTestId('确认导入旧档案')).toHaveText('覆盖本地档案')
  await page.getByTestId('取消导入旧档案').click()
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('1/1297')
  await upload()
  await page.getByTestId('确认导入旧档案').click()
  await expect(page.locator('.w-message[data-type="success"]')).toHaveText(
    '成就档案已导入并保存到此浏览器',
  )
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('0/1297')
  await expect(overwritePrompt).toHaveCount(0)
  await expectOptions(page, '账号档案', 2)

  await more.click()
  await page.getByTestId('删除档案').click()
  await expect(page.getByTestId('删除档案确认')).toContainText('UID 10001')
  await page.getByTestId('取消删除档案').click()
  await expect(account).toHaveAttribute('data-value', 'uid:10001')
  await more.click()
  await page.getByTestId('删除档案').click()
  await page.getByTestId('确认删除档案').click()
  await expect(account).toHaveAttribute('data-value', 'default')
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('1/1297')
  await expectOptions(page, '账号档案', 1)
  await more.click()
  await page.getByTestId('删除档案').click()
  await expect(page.getByTestId('删除档案确认')).toContainText('清除默认账号的所有成就勾选记录')
  await page.getByTestId('取消删除档案').click()
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('1/1297')
  await more.click()
  await page.getByTestId('删除档案').click()
  await page.getByTestId('确认删除档案').click()
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('0/1297')
  await expect(page.getByTestId('completed-astrite')).toHaveText('0')
  await expect(page.getByTestId('completed-hidden')).toHaveText('0')
  await expect(page.locator('.category-nav-row .nav-count').first()).toHaveText(/^0\/\d+$/)
  await expect(page.locator('.sub-navigation .nav-count').first()).toHaveText(/^0\/\d+$/)
  await page.reload()
  await expect(account).toHaveAttribute('data-value', 'default')
  await expect(page.locator('.nav-overview .nav-count')).toHaveText('0/1297')
  await editFirstAchievement('0/1')
})
