import { expect, test } from '@playwright/test'

test('multiple versions filter together with search and show on achievement cards', async ({
  page,
}) => {
  await page.goto('/')
  const trigger = page.getByTestId('版本筛选')
  const popover = page.getByTestId('版本筛选弹层')
  const list = page.getByTestId('成就列表')
  const search = page.getByTestId('搜索成就')
  const versionOf = (id: number) =>
    list.getByTestId(`查看成就详情 ${id}`).locator('.achievement-title-text + .achievement-version')
  const version38 = popover.locator('[data-version="3.8"]')
  const version37 = popover.locator('[data-version="3.7"]')

  await expect(trigger).toHaveText('全部版本')
  await trigger.click()
  await version37.check()
  await expect(trigger).toHaveText('3.7')
  await version38.check()
  await expect(trigger).toHaveText('3.8, 3.7')
  await expect(popover).toBeVisible()
  await expect(version37).toBeChecked()
  await expect(version38).toBeChecked()
  await expect(list).toHaveAttribute('data-count', '98')

  await search.click()
  await expect(popover).toBeHidden()
  await search.fill('200141')
  await expect(versionOf(200141)).toHaveText('3.7')
  await search.fill('200137')
  await expect(versionOf(200137)).toHaveText('3.8')
  await expect(versionOf(200137)).toHaveCSS('vertical-align', 'super')

  await trigger.click()
  await version38.uncheck()
  await expect(list).toHaveAttribute('data-count', '0')
  await popover.getByText('全部版本', { exact: true }).click()
  await expect(trigger).toHaveText('全部版本')
  await expect(version37).not.toBeChecked()
  await expect(search).toHaveValue('200137')
  await expect(versionOf(200137)).toHaveText('3.8')

  await version37.check()
  await expect(list).toHaveAttribute('data-count', '0')
  await search.click()
  await expect(popover).toBeHidden()
  await list.getByText('清除搜索与筛选', { exact: true }).click()
  await expect(trigger).toHaveText('全部版本')
  await expect(search).toHaveValue('')
})
