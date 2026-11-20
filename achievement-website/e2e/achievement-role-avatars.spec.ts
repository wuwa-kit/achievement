import { expect, test } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import roleData from '../../data/roles.json' with { type: 'json' }

test('role avatars and hidden badges have separate positions and preserve card controls', async ({
  page,
}, testInfo) => {
  const mockImage = fileURLToPath(
    new URL('../src/assets/achievement-icons/achievement-tab.png', import.meta.url),
  )
  const avatarUrls = new Set(
    ([1501, 1502, 1511] as const).map((id) => roleData.roles[id].avatarUrl),
  )
  await page.route(
    (url) => avatarUrls.has(url.href),
    (route) => route.fulfill({ path: mockImage }),
  )
  await page.addInitScript(() => {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    Math.random = () => (navigation.type === 'reload' ? 0.75 : 0.25)
  })
  await page.goto('/')

  const search = page.getByTestId('搜索成就')
  await search.fill('302098')
  const lucyRow = page.getByTestId('成就卡片 302098')
  const lucy = lucyRow.locator('.achievement-role-avatars img')
  const hiddenBadge = lucyRow.locator('.hidden-badge')
  await expect(lucy).toHaveAttribute('data-role-id', '1511')
  await expect(hiddenBadge).toBeVisible()
  const avatarBox = (await lucy.boundingBox())!
  const badgeBox = (await hiddenBadge.boundingBox())!
  const emblemBox = (await lucyRow.locator('.achievement-emblem').boundingBox())!
  expect(badgeBox.y + badgeBox.height / 2).toBeCloseTo(avatarBox.y + avatarBox.height / 2)
  expect(badgeBox.x).toBeGreaterThan(emblemBox.x + emblemBox.width / 2)
  expect(badgeBox.x + badgeBox.width).toBeLessThan(emblemBox.x + emblemBox.width)
  expect(badgeBox.x).toBeGreaterThan(avatarBox.x + avatarBox.width)
  await expect(lucyRow.locator('..').locator('.achievement-title img')).toHaveCount(0)
  if (testInfo.project.name === 'desktop') {
    await hiddenBadge.hover()
    await expect(page.locator('.w-tooltip')).toHaveText('隐藏成就')
    await lucy.hover()
    await expect(page.locator('.w-tooltip')).toHaveText('指定角色：露西')
  }
  await hiddenBadge.click()
  await expect(lucyRow).toHaveAttribute('data-completed', 'false')
  await lucy.click()
  await expect(lucyRow).toHaveAttribute('data-completed', 'true')

  await page.getByTestId('查看成就详情 302098').click()
  await expect(page.locator('.achievement-detail-roles')).toHaveText('指定角色：露西')
  await page.getByTestId('关闭详情').click()

  await search.fill('300147')
  const roverRow = page.getByTestId('成就卡片 300147')
  const rover = roverRow.locator('.achievement-role-avatars')
  const spectroAvatar = rover.locator('img')
  await expect(rover).toHaveCSS('position', 'absolute')
  await expect(spectroAvatar).toHaveCount(1)
  await expect(spectroAvatar).toHaveAttribute('data-role-id', '1501')
  await expect(spectroAvatar).toHaveCSS(
    'width',
    testInfo.project.name === 'mobile' ? '20px' : '24px',
  )

  const placement = await roverRow.evaluate((row) => {
    const card = row.getBoundingClientRect()
    const avatars = row.querySelector('.achievement-role-avatars')!.getBoundingClientRect()
    const emblem = row.querySelector('.achievement-emblem')!.getBoundingClientRect()
    const title = row.parentElement!.querySelector('.achievement-title')!.getBoundingClientRect()
    const emblemCenterY = emblem.top + emblem.height / 2
    return {
      topInset: avatars.top - card.top,
      leftInset: avatars.left - card.left,
      titleClearance: title.left - avatars.right,
      emblemCenterOffset: emblemCenterY - (card.top + card.height / 2),
    }
  })
  expect(placement.topInset).toBeCloseTo(6)
  expect(placement.leftInset).toBeCloseTo(6)
  expect(placement.titleClearance).toBeGreaterThan(0)
  expect(placement.emblemCenterOffset).toBeCloseTo(0, 0)

  await page.getByTestId('查看成就详情 300147').click()
  await expect(page.locator('.achievement-detail-roles')).toHaveText('指定角色：漂泊者·衍射')
  await page.getByTestId('关闭详情').click()

  await page.evaluate(() => {
    Math.random = () => 0.75
  })
  await search.fill('300148')
  const havocAvatar = page.getByTestId('成就卡片 300148').locator('.achievement-role-avatars img')
  await expect(havocAvatar).toHaveCount(1)
  await expect(havocAvatar).toHaveAttribute('data-role-id', '1605')

  await page.reload()
  await expect(havocAvatar).toHaveCount(1)
  await expect(havocAvatar).toHaveAttribute('data-role-id', '1604')
  await search.fill('300147')
  await expect(spectroAvatar).toHaveCount(1)
  await expect(spectroAvatar).toHaveAttribute('data-role-id', '1502')

  await search.fill('100108')
  const hiddenOnly = page.getByTestId('成就卡片 100108')
  const standaloneBadge = hiddenOnly.locator('.hidden-badge')
  await expect(standaloneBadge).toBeVisible()
  const standaloneBox = (await standaloneBadge.boundingBox())!
  const hiddenCardBox = (await hiddenOnly.boundingBox())!
  expect(standaloneBox.x - hiddenCardBox.x).toBeCloseTo(6)
  expect(standaloneBox.y - hiddenCardBox.y).toBeCloseTo(6)
  await expect(hiddenOnly.locator('.achievement-role-avatars')).toHaveCount(0)

  await search.fill('100101')
  await expect(page.getByTestId('成就卡片 100101')).toBeVisible()
  await expect(page.locator('.achievement-role-avatars')).toHaveCount(0)
})
