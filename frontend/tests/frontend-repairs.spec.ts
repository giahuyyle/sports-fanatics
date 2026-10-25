import { expect, test } from '@playwright/test'
import { initialState } from '../src/state/data'
import { autoPick } from '../src/state/engine'

const key = 'sports-fanatics:v1'

test('browser Back returns to the original hashless landing and unknown pages have a heading', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Open app', exact: true }).click()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'DRAFT NIGHT STARTS HERE.' })).toBeVisible()
  await page.goto('/#/missing')
  await expect(page.locator('h1')).toHaveText('This page is out of bounds.')
  await expect(page).toHaveTitle('Page unavailable · Sports Fanatics')
})

test('dialog padding stays open and mobile navigation traps focus and closes with Escape', async ({
  page,
}) => {
  await page.goto('/#/nba/leagues/office/lobby')
  await page
    .getByRole('button', { name: /Room for a rival/ })
    .first()
    .click()
  const dialog = page.getByRole('dialog'),
    box = (await dialog.boundingBox())!
  await page.mouse.click(box.x + 5, box.y + box.height / 2)
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 375, height: 812 })
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  const nav = page.getByRole('dialog', { name: 'App navigation' })
  await nav.locator('.profile-button').focus()
  await page.keyboard.press('Tab')
  expect(await nav.evaluate((e) => e.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(nav).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeFocused()
})

test('mobile player selection exposes its action and supports unaccented searches', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/#/nba/leagues/sunday/draft')
  await page.getByLabel('Search players').fill('Sengun')
  await expect(page.getByRole('button', { name: /^Alperen Şengün/ })).toBeVisible()
  await page.getByLabel('Search players').fill('Stephen Curry')
  await page.getByRole('button', { name: /Stephen Curry GSW/ }).click()
  await expect(page.getByRole('button', { name: 'Draft Stephen', exact: true })).toBeInViewport()
  await expect(page.getByRole('tabpanel', { name: 'Players', exact: true })).toBeVisible()
})

test('picking chooses another available player and inspecting an owned pick states ownership', async ({
  page,
}) => {
  await page.clock.install()
  await page.goto('/#/nba/leagues/sunday/draft')
  await page.getByRole('button', { name: 'Draft Shai', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Draft Anthony', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Full board', exact: true }).click()
  await page.locator('.pick-player[title="Shai Gilgeous-Alexander"]').click()
  await expect(page.locator('.player-detail .draft-help')).toHaveText('Already on your roster.')
})

test('a damaged disabled-feature slice preserves saved NBA leagues', async ({ page }) => {
  const state = initialState()
  state.leagues[0].name = 'My saved league'
  state.fpl.squad = state.fpl.squad.slice(1)
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  await page.goto('/#/home')
  await expect(page.getByRole('heading', { name: 'My saved league', exact: true })).toBeVisible()
  await expect(page.locator('.storage-warning')).toContainText('Valid leagues were preserved')
})

test('cross-tab edits merge and two draft tabs do not double the clock speed', async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage()
  await a.goto('/#/home')
  await b.goto('/#/settings')
  await b.getByLabel('Display name', { exact: true }).fill('Jamie in second tab')
  await b.getByRole('button', { name: 'Save preferences' }).click()
  await expect(b.getByRole('status').filter({ hasText: 'Profile saved' })).toBeVisible()
  await a.goto('/#/nba/leagues/sunday/draft')
  await a.getByRole('button', { name: 'Queue Anthony Edwards', exact: true }).click()
  await expect
    .poll(async () => a.evaluate((key) => JSON.parse(localStorage.getItem(key)!).profile.name, key))
    .toBe('Jamie in second tab')
  await b.goto('/#/nba/leagues/sunday/draft')
  const before = await a.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).leagues[0].remaining,
    key,
  )
  await a.waitForTimeout(2200)
  const after = await a.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).leagues[0].remaining,
    key,
  )
  expect(before - after).toBeLessThanOrEqual(3)
})

test('storage failure reports visit-only updates and deleted demo links recover', async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw Error('Storage blocked')
      },
    }),
  )
  await page.goto('/#/settings')
  await page.getByLabel('Display name', { exact: true }).fill('Visit only')
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.locator('.success-note')).toContainText('this visit only')
})

test('landing practice links work after clearing leagues', async ({ page }) => {
  const state = initialState()
  state.leagues = []
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore the draft', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Draft board', exact: true })).toBeVisible()
})

test('team-colored cards reserve equal portrait, identity and footer rows', async ({ page }) => {
  const state = initialState()
  state.leagues[0].capacity = 6
  state.leagues[0].picks = []
  state.leagues[0].userId = 'maya'
  state.leagues[0].participants.push(
    { id: 'one', name: 'One', team: 'One', guest: true },
    { id: 'two', name: 'Two', team: 'Two', guest: true },
  )
  while (state.leagues[0].status !== 'complete') state.leagues[0] = autoPick(state.leagues[0])
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/#/nba/leagues/sunday/recap')
  await expect(page.locator('.player-card')).toHaveCount(5)
  const cards = await page.locator('.player-card').evaluateAll((cards) =>
    cards.map((card) => ({
      portrait: card.querySelector('.player-card-portrait')!.getBoundingClientRect().height,
      identity: card.querySelector('.player-card-identity')!.getBoundingClientRect().height,
      footer:
        card.querySelector('footer')!.getBoundingClientRect().top -
        card.getBoundingClientRect().top,
      background: getComputedStyle(card).backgroundColor,
    })),
  )
  expect(new Set(cards.map((c) => c.portrait)).size).toBe(1)
  expect(new Set(cards.map((c) => c.identity)).size).toBe(1)
  expect(new Set(cards.map((c) => c.footer)).size).toBe(1)
  expect(new Set(cards.map((c) => c.background)).size).toBeGreaterThan(1)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
  await page.screenshot({
    path: '/private/tmp/sports-fanatics-repairs/cards-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.screenshot({
    path: '/private/tmp/sports-fanatics-repairs/cards-mobile.png',
    fullPage: true,
  })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
  ).toBeLessThanOrEqual(1)
})

test('valid long names fit all main NBA layouts', async ({ page }) => {
  const state = initialState()
  state.profile.name = 'W'.repeat(40)
  state.leagues.forEach((league) => {
    league.name = 'W'.repeat(40)
    league.participants.forEach((p) => {
      p.name = 'W'.repeat(40)
      p.team = 'W'.repeat(30)
    })
  })
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  for (const width of [320, 375, 768, 1110, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const route of [
      '/home',
      '/nba/leagues/office/lobby',
      '/nba/leagues/sunday/draft',
      '/settings',
    ]) {
      await page.goto(`/#${route}`)
      await page.locator('h1').waitFor()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - innerWidth),
        `${route}, ${width}px`,
      ).toBeLessThanOrEqual(1)
    }
  }
})
