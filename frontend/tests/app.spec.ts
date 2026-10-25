import { test, expect } from '@playwright/test'
import { initialState } from '../src/state/data'

const key = 'sports-fanatics:v1'
test('landing carousel, FAQ, and public navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'DRAFT NIGHT STARTS HERE.' })).toBeVisible()
  await page.getByRole('button', { name: 'Next featured NBA player' }).click()
  await expect(page.getByRole('group', { name: '2 of 6: Nikola Jokić' })).toBeVisible()
  await page.getByRole('button', { name: 'How does an NBA snake draft work?' }).click()
  await expect(
    page.getByRole('button', { name: 'How does an NBA snake draft work?' }),
  ).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Create your league', exact: true }).first().click()
  await expect(page).toHaveURL(/#\/nba\/create/)
})
test('create, fill, and start a private league', async ({ page }) => {
  await page.goto('/#/nba/create')
  await page.getByRole('button', { name: 'Create league', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('name')
  await page.getByLabel('League name *', { exact: true }).fill('Weekend Rivals')
  await page.getByLabel('Your team name *', { exact: true }).fill('Court Kings')
  await page.getByRole('combobox', { name: 'Participants', exact: true }).selectOption('2')
  await page.getByRole('combobox', { name: 'Roster size', exact: true }).selectOption('3')
  await page.getByRole('button', { name: 'Create league', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Weekend Rivals.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the draft' })).toBeDisabled()
  await page.getByRole('button', { name: /Room for a rival/ }).click()
  await page.getByLabel('Manager name', { exact: true }).fill('Taylor')
  await page.getByLabel('Team name', { exact: true }).fill('The Rivals')
  await page.getByRole('button', { name: 'Add guest team', exact: true }).click()
  await page.getByRole('button', { name: 'Start the draft' }).click()
  await expect(page.getByRole('heading', { name: 'Draft board', exact: true })).toBeVisible()
  await expect(page.getByText('Pick 1 of 6', { exact: true })).toBeVisible()
})
test('join validation and creator restriction', async ({ page }) => {
  await page.goto('/#/nba/join')
  await page.getByLabel('Invite code *').fill('WRONG')
  await page.getByLabel('Your team name *').fill('New Rivals')
  await page.getByRole('button', { name: 'Join league', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('wasn’t found')
  await page.getByLabel('Invite code *').fill('SUNDAY')
  await page.getByRole('button', { name: 'Join league', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('already started')
  await page.getByLabel('Invite code *').fill('OFFICE')
  await page.getByRole('button', { name: 'Join league', exact: true }).click()
  await expect(page.getByText('Only the league creator can start this draft.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start the draft' })).toBeDisabled()
})
test('snake endpoints, queue ordering, picks, and reload persistence', async ({ page }) => {
  await page.clock.install()
  await page.goto('/#/nba/leagues/sunday/draft')
  await page.getByRole('button', { name: 'Queue Stephen Curry', exact: true }).click()
  await page.getByRole('button', { name: 'Queue Anthony Edwards', exact: true }).click()
  await page.getByRole('button', { name: 'Queue 2', exact: true }).click()
  await page.getByRole('button', { name: 'Move Anthony Edwards up', exact: true }).click()
  await page.getByRole('button', { name: 'Draft Shai', exact: true }).click()
  await expect(page.getByText('Pick 5 of 20', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'You’re up. Make it count.' })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Pick 5 of 20', { exact: true })).toBeVisible()
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(saved.leagues[0].queue).toEqual([1630162, 201939])
  expect(saved.leagues[0].picks.at(-1).playerId).toBe(1628983)
  await page.getByRole('button', { name: 'Queue 2', exact: true }).click()
  await page.getByRole('button', { name: 'Remove Stephen Curry from queue', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Remove Anthony Edwards from queue', exact: true }),
  ).toBeFocused()
})
test('timeout uses queue, offline pause preserves state, search can be cleared', async ({
  page,
}) => {
  const state = initialState()
  state.leagues[0].remaining = 1
  state.leagues[0].queue = [201939]
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  await page.clock.install()
  await page.goto('/#/nba/leagues/sunday/draft')
  await page.clock.runFor(1100)
  await expect(page.getByRole('status')).toContainText('Automatic pick: Stephen Curry')
  await page.getByRole('button', { name: 'Connection status' }).click()
  await page.getByRole('button', { name: 'Simulate going offline' }).click()
  await expect(page.getByRole('button', { name: 'Draft paused · offline' })).toBeDisabled()
  await page.getByLabel('Search players').fill('zzzzzz')
  await expect(page.getByText('No players match that search.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.getByRole('button', { name: /Queue Anthony Edwards/ })).toBeVisible()
  await page.getByRole('button', { name: 'Connection status' }).click()
  await page.getByRole('button', { name: 'Resume local draft' }).click()
  await expect(page.getByRole('button', { name: 'Draft Shai', exact: true })).toBeEnabled()
})
test('NBA focus hides FPL entry points and preserves saved data on old links', async ({ page }) => {
  const state = initialState()
  state.savedPlan = { setup: structuredClone(state.fpl), savedAt: new Date().toISOString() }
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  for (const path of ['/', '/home', '/nba', '/settings']) {
    await page.goto(`/#${path}`)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/FPL|Premier League|Transfer comparisons/)
  }
  for (const path of ['/fpl', '/fpl/squad']) {
    await page.goto(`/#${path}`)
    await expect(page).toHaveURL(/#\/nba$/)
    await expect(page.getByRole('heading', { name: 'Your leagues, your rivals.' })).toBeVisible()
  }
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key)
  expect(saved.fpl).toEqual(state.fpl)
  expect(saved.savedPlan).toEqual(state.savedPlan)
})
test('settings save, confirmed reset, and empty home', async ({ page }) => {
  await page.goto('/#/settings')
  await page.getByLabel('Display name', { exact: true }).fill('Jamie')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved')
  await page.getByRole('button', { name: 'Clear local leagues' }).click()
  await page.getByRole('button', { name: 'Keep my leagues' }).click()
  await page.getByRole('button', { name: 'Clear local leagues' }).click()
  await page.getByRole('button', { name: 'Clear leagues', exact: true }).click()
  await page.goto('/#/home')
  await expect(
    page.getByRole('heading', { name: 'Your people are your home advantage.' }),
  ).toBeVisible()
})
test('unknown leagues recover and old league routes normalize', async ({ page }) => {
  await page.goto('/#/nba/leagues/missing/draft')
  await expect(page.getByRole('heading', { name: 'This page is out of bounds.' })).toBeVisible()
  await page.goto('/#/nba/leagues/office/draft')
  await expect(page).toHaveURL(/office\/lobby/)
  await page.goto('/#/nba/leagues/sunday/lobby')
  await expect(page).toHaveURL(/sunday\/draft/)
})
test('screens fit desktop and narrow mobile widths', async ({ page }) => {
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of [
      '/',
      '/home',
      '/nba/create',
      '/nba/leagues/office/lobby',
      '/nba/leagues/sunday/draft',
      '/nba',
      '/settings',
    ]) {
      await page.goto(`/#${path}`)
      await page.locator('h1').waitFor()
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(300)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow, `${path} at ${width}px`).toBeLessThanOrEqual(1)
      if ([1440, 375].includes(width) && ['/', '/nba/leagues/sunday/draft'].includes(path)) {
        await page.screenshot({
          path: `/private/tmp/sports-fanatics-qa/${width}-${path === '/' ? 'landing' : 'draft'}.png`,
          fullPage: true,
        })
      }
    }
  }
})

test('recap normalizes completed drafts and inspects another team', async ({ page }) => {
  const { autoPick } = await import('../src/state/engine')
  const state = initialState()
  while (state.leagues[0].status !== 'complete') state.leagues[0] = autoPick(state.leagues[0])
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key,
    state,
  })
  await page.goto('/#/nba/leagues/sunday/draft')
  await expect(page).toHaveURL(/sunday\/recap/)
  await expect(page.locator('.recap-pick')).toHaveCount(5)
  await page.getByRole('combobox', { name: 'Inspect a team' }).selectOption('maya')
  await expect(page.getByRole('heading', { name: 'Buckets & Chill', exact: true })).toBeVisible()
  await expect(page.locator('.recap-pick')).toHaveCount(5)
})

test('reduced motion, keyboard carousel, skip link, and browser history', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install()
  await page.goto('/')
  await page.clock.runFor(6000)
  await expect(page.getByRole('group', { name: '1 of 6: Shai Gilgeous-Alexander' })).toBeVisible()
  await page.getByRole('button', { name: 'Next featured NBA player' }).focus()
  await page.keyboard.press('End')
  await expect(page.getByRole('group', { name: '6 of 6: Stephen Curry' })).toBeVisible()
  await page.getByRole('button', { name: 'Open app', exact: true }).click()
  await page.getByRole('link', { name: 'Skip to content' }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/home/)
  await page.getByRole('button', { name: 'Create a league', exact: true }).click()
  await page.getByLabel('League name *').fill('Saved form')
  await page.goBack()
  await expect(page).toHaveURL(/#\/home/)
  await page.goForward()
  await expect(page.getByLabel('League name *')).toHaveValue('Saved form')
})

test('unavailable storage keeps the app usable', async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage blocked')
      },
    }),
  )
  await page.goto('/#/home')
  await expect(page.getByRole('status')).toContainText('Changes will last for this visit only')
  await page.getByRole('button', { name: 'Create a league', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your people. Your league.' })).toBeVisible()
})

test('mobile menu and focused draft views remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/#/nba/leagues/sunday/draft')
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'FPL Assistant' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Close navigation' }).click()
  await page.getByRole('tab', { name: 'Board', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Draft board', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Roster 0', exact: true }).click()
  await expect(page.getByText('Open roster spot', { exact: true }).first()).toBeVisible()
})
