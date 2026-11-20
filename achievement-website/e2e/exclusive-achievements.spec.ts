import { expect, test } from '@playwright/test'

test('exclusive achievements stay together and switching a completion is immediate and saved', async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/')
  const list = page.getByTestId('成就列表')
  const search = page.getByTestId('搜索成就')
  const group = page.getByTestId('exclusive-achievements-200710')
  const first = group.getByTestId('成就卡片 200710')
  const second = group.getByTestId('成就卡片 200711')
  const overviewCount = page.locator('.nav-overview-heading .nav-count')
  const statistics = page.getByTestId('catalog-statistics-trigger')
  const dialog = page.getByTestId('catalog-statistics-dialog')

  if (testInfo.project.name === 'mobile') await page.getByTestId('打开导航').click()
  await expect(statistics).toBeInViewport()
  await expect(statistics).toHaveText('1307')
  await expect(dialog).toHaveCount(0)
  if (testInfo.project.name === 'desktop') await statistics.press('Enter')
  else await statistics.tap()
  await expect(dialog).toBeInViewport()
  await expect(statistics).toHaveAttribute('data-expanded', 'true')
  await expect(dialog.getByText('图鉴统计', { exact: true })).toBeVisible()
  for (const value of ['1307 条', '1303 条', '4 条', '7 组，14 条', '1296 项', '8755']) {
    await expect(dialog.getByText(value, { exact: true })).toBeVisible()
  }
  await expect(
    dialog.getByText('图鉴总数包含排除项，单账号达成上限按每组二选一计一项'),
  ).toHaveCount(0)
  const scroll = dialog.getByTestId('catalog-statistics-scroll')
  const excluded = scroll.getByTestId('catalog-excluded-achievements')
  await expect(excluded.getByText('找回来了，都找回来了', { exact: true })).toBeVisible()
  await expect(excluded.getByText('dnt/这是一个废弃的成就', { exact: true })).toBeVisible()
  await expect(excluded.getByText('行于未明', { exact: true })).toBeVisible()
  await expect(excluded.getByText('要用声骸打败声骸', { exact: true })).toBeVisible()
  await expect(excluded.getByText('将一个声骸升到最高级', { exact: true })).toBeVisible()
  for (const reason of [
    '当前游戏配置缺少触发此成就的逻辑',
    '游戏客户端已标记为废弃',
    '与已收录成就 #200141 同名同描述，暂按重复配置排除',
    '当前客户端未显示此成就，也未提供进度',
  ]) {
    await expect(excluded.getByText(reason, { exact: true })).toBeVisible()
  }
  const exclusiveGroups = scroll.getByTestId('catalog-exclusive-group')
  await expect(exclusiveGroups).toHaveCount(7)
  const starSeaGroup = exclusiveGroups.filter({ hasText: '独自凝望的星海' })
  await expect(starSeaGroup.getByText('恒定不变的星海', { exact: true })).toBeVisible()
  await expect(starSeaGroup.getByText('在纪闻任务「星海如故」中，选择告知真相。')).toBeVisible()
  await expect(starSeaGroup.getByText('在纪闻任务「星海如故」中，选择隐瞒真相。')).toBeVisible()
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await expect(exclusiveGroups.last()).toBeInViewport()
  await expect(dialog.getByText('1307 条', { exact: true })).toBeInViewport()
  await expect(dialog.getByTestId('close-catalog-statistics')).toBeInViewport()
  if (testInfo.project.name === 'desktop') await page.keyboard.press('Escape')
  else {
    await dialog.getByTestId('close-catalog-statistics').tap()
    await expect(dialog).toBeHidden()
    await statistics.tap()
    await expect(dialog).toBeVisible()
    await page.touchscreen.tap(10, 10)
  }
  await expect(dialog).toBeHidden()
  if (testInfo.project.name === 'mobile') await page.locator('.nav-overview-heading').click()

  await search.fill('200704')
  await expect(list).toHaveAttribute('data-count', '0')
  await search.fill('200711')
  await expect(group.getByText('二选一')).toBeVisible()
  await expect(group.locator('.achievement-row')).toHaveCount(2)
  await expect(list).toHaveAttribute('data-count', '2')
  await expect(first).toHaveAttribute('data-completed', 'false')
  await expect(second).toHaveAttribute('data-completed', 'false')
  await expect(overviewCount).toHaveText('0/1296')
  await page.getByTestId('只看隐藏成就').check()
  await expect(group.locator('.achievement-row')).toHaveCount(2)

  await first.click({ position: { x: 40, y: 40 } })
  await expect(first).toHaveAttribute('data-completed', 'true')
  await expect(second).toHaveAttribute('data-exclusive-alternative', 'true')
  await expect(overviewCount).toHaveText('1/1296')
  await expect(page.getByTestId('completed-astrite')).toHaveText('5')

  await group.getByTestId('查看成就详情 200711').click()
  await page.getByTestId('编辑成就完成状态').click()
  await expect(page.getByTestId('confirm-exclusive-achievement')).toHaveCount(0)
  await expect(first).toHaveAttribute('data-completed', 'false')
  await expect(second).toHaveAttribute('data-completed', 'true')
  await page.getByTestId('关闭详情').click()
  await first.click({ position: { x: 40, y: 40 } })
  await expect(first).toHaveAttribute('data-completed', 'true')
  await expect(second).toHaveAttribute('data-completed', 'false')

  await second.click({ position: { x: 40, y: 40 } })
  await expect(page.getByTestId('confirm-exclusive-achievement')).toHaveCount(0)
  await expect(first).toHaveAttribute('data-completed', 'false')
  await expect(second).toHaveAttribute('data-completed', 'true')
  await expect(overviewCount).toHaveText('1/1296')
  await page.getByTestId('隐藏已完成').check()
  await expect(list).toHaveAttribute('data-count', '0')
  await expect(group).toHaveCount(0)

  await page.reload()
  await expect(page.getByTestId('隐藏已完成')).toBeChecked()
  await expect(list).toHaveAttribute('data-count', '0')
  await page.getByTestId('隐藏已完成').uncheck()
  await search.fill('200710')
  await expect(first).toHaveAttribute('data-exclusive-alternative', 'true')
  await expect(second).toHaveAttribute('data-completed', 'true')
  expect(errors).toEqual([])
})
