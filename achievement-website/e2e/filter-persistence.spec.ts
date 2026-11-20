import { expect, test, type Page } from '@playwright/test'
import { readPreviewResponse } from './catalog-helpers'
import { selectValue } from './select-helpers'

for (const [name, id, count] of [
  ['single', 100101, 1],
  ['exclusive', 200710, 2],
] as const) {
  test(`${name} completions stay visible until filters change, not when equal values are reapplied`, async ({
    page,
  }) => {
    await page.goto('/')
    const search = page.getByTestId('搜索成就')
    const list = page.getByTestId('成就列表')
    const row = page.getByTestId(`成就卡片 ${id}`)
    const hideCompleted = page.getByTestId('隐藏已完成')
    const expectRetained = async () => {
      await expect(row).toHaveAttribute('data-completed', 'true')
      await expect(list).toHaveAttribute('data-count', count.toString())
    }
    const reapplySameVersions = async () => {
      await page.getByTestId('版本筛选').click()
      await page.getByTestId('版本筛选弹层').getByText('全部版本', { exact: true }).click()
      await search.click()
    }

    await search.fill(id.toString())
    await hideCompleted.check()
    await row.press('Enter')
    await expectRetained()
    if (name === 'exclusive')
      await expect(page.getByTestId('成就卡片 200711')).toHaveAttribute(
        'data-exclusive-alternative',
        'true',
      )
    await reapplySameVersions()
    await expectRetained()
    await row.press('Enter')
    await expect(row).toHaveAttribute('data-completed', 'false')
    await expect(list).toHaveAttribute('data-count', count.toString())
    await row.press('Enter')
    await expectRetained()

    await search.fill(`${id} `)
    await expect(list).toHaveAttribute('data-count', '0')
    await hideCompleted.uncheck()
    await expectRetained()
    await row.press('Enter')
    await expect(row).toHaveAttribute('data-completed', 'false')
    await hideCompleted.check()
    await row.press('Enter')
    await expectRetained()
    await reapplySameVersions()
    await expectRetained()
    await page.reload()
    await expect(hideCompleted).toBeChecked()
    await expect(list).toHaveAttribute('data-count', '0')
  })
}

async function expectFilters(page: Page, query: string, version: string, checked: boolean) {
  await expect(page.getByTestId('搜索成就')).toHaveValue(query)
  await expect(page.getByTestId('版本筛选')).toHaveText(version)
  await expect(page.getByTestId('只看隐藏成就')).toBeChecked({ checked })
  await expect(page.getByTestId('隐藏已完成')).toBeChecked({ checked })
}

async function setFilters(page: Page) {
  await page.getByTestId('搜索成就').fill('200141')
  await page.getByTestId('版本筛选').click()
  await page.getByTestId('版本筛选弹层').locator('[data-version="3.7"]').check()
  await page.getByTestId('搜索成就').click()
  await page.getByTestId('只看隐藏成就').check()
  await page.getByTestId('隐藏已完成').check()
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1')
}

test('checkbox preferences persist across tabs while search and versions stay in their tab', async ({
  page,
  context,
}) => {
  await page.goto('/')
  await setFilters(page)
  await page.reload()
  await expectFilters(page, '200141', '3.7', true)
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1')

  const other = await context.newPage()
  await other.goto('/')
  await expectFilters(other, '', '全部版本', true)
  await other.getByTestId('搜索成就').fill('another tab')
  await page.reload()
  await expectFilters(page, '200141', '3.7', true)
  await other.close()

  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/')
  await expectFilters(reopened, '', '全部版本', true)
})

test('import and account switching retain filters and refresh the completed snapshot', async ({
  page,
}) => {
  await page.goto('/')
  await setFilters(page)
  const catalog = await readPreviewResponse(await page.request.get('/data/achievement-catalog.png'))
  await page.getByTestId('导入成就 JSON 文件').setInputFiles({
    name: 'achievements.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...catalog,
        preview: false,
        uid: '10001',
        capturedAt: '2020-01-02T00:00:00Z',
        achievements: catalog.achievements.map((item) =>
          item.id === 200141 ? { ...item, status: 'completed' } : item,
        ),
      }),
    ),
  })
  const account = page.getByTestId('账号档案')
  await expect(account).toHaveAttribute('data-value', 'uid:10001')
  await expectFilters(page, '200141', '3.7', true)
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '0')

  await selectValue(page, account, 'default')
  await expectFilters(page, '200141', '3.7', true)
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '1')
  await selectValue(page, account, 'uid:10001')
  await expectFilters(page, '200141', '3.7', true)
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '0')
  await page.reload()
  await expectFilters(page, '200141', '3.7', true)
  await expect(page.getByTestId('成就列表')).toHaveAttribute('data-count', '0')

  await page.getByText('清除搜索与筛选', { exact: true }).click()
  await expectFilters(page, '', '全部版本', false)
  expect(
    await page.evaluate(() => [
      localStorage.getItem('wuwa-viewer-filters'),
      sessionStorage.getItem('wuwa-viewer-session-filters'),
    ]),
  ).toEqual([null, null])
  await page.reload()
  await expectFilters(page, '', '全部版本', false)
})
