import { expect, test } from '@playwright/test'

// Connected verification requires FIREBASE_EMULATOR_E2E=1, ADMIN_TEST_EMAIL,
// ADMIN_TEST_PASSWORD, ADMIN_TEST_API, VITE_FIREBASE_* and API_PROXY_TARGET.
// Start local Auth emulator/API; grant admin to the supplied emulator account.
// PLAYWRIGHT_BASE_URL selects an isolated Vite port.
const connected = process.env.FIREBASE_EMULATOR_E2E === '1'

test('admin explains missing Firebase configuration', async ({ page }) => {
  test.skip(connected, 'Connected configuration has a real sign-in screen')
  await page.goto('/#/admin')
  await expect(page.getByRole('heading', { name: 'Firebase configuration required' })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy()
})

test('admin signs in, edits players, imports stats, publishes a pool, and fits mobile', async ({
  page,
  request,
}) => {
  test.skip(!connected, 'Requires local Firebase Auth emulator and PostgreSQL API')
  test.setTimeout(90_000)
  const email = process.env.ADMIN_TEST_EMAIL!
  const password = process.env.ADMIN_TEST_PASSWORD!
  const api = process.env.ADMIN_TEST_API!
  const name = `Synthetic browser rookie ${Date.now()}`
  await page.goto('/#/admin')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Add player' })).toBeVisible()
  await page.getByLabel('Player name', { exact: true }).fill(name)
  await page.getByRole('combobox', { name: 'Tier', exact: true }).selectOption('1')
  await page.getByLabel('Current-season rookie with no NBA appearances').check()
  await page
    .getByText('Eligible positions', { exact: true })
    .locator('..')
    .getByLabel('SF', { exact: true })
    .check()
  await page.getByRole('button', { name: 'Save player', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Player saved.' })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: name })
  await expect(row).toContainText('PG / SF')
  await row.getByRole('button', { name: `Edit ${name}` }).click()
  await page.getByRole('combobox', { name: 'Tier', exact: true }).selectOption('2')
  await page.getByRole('button', { name: 'Save player', exact: true }).click()
  await expect(row).toContainText('T2')
  await page.getByLabel('Data source', { exact: true }).fill('Synthetic browser fixture')
  await page.getByLabel('Import file', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('[{}]'),
  })
  await page.getByRole('button', { name: 'Validate and import' }).click()
  await expect(page.getByRole('alert')).toContainText('No statistics were changed.')
  await expect(page.getByText('Validation errors', { exact: true }).first()).toBeVisible()
  const login = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    { data: { email, password, returnSecureToken: true } },
  )
  const token = (await login.json()).idToken
  const catalog = await request.get(`${api}/api/v1/players?search=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const player = (await catalog.json())[0]
  const totals = Object.fromEntries(
    'games starts minutes points rebounds assists steals blocks turnovers fouls fg_made fg_attempted three_made three_attempted ft_made ft_attempted'
      .split(' ')
      .map((key) => [key, 0]),
  )
  totals.games = 10
  totals.points = 50
  await page.getByLabel('Import file', { exact: true }).setInputFiles({
    name: 'valid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify([
        {
          player_id: player.id,
          season: player.rookie_season,
          phase: 'regular',
          scope: 'TOTAL',
          totals,
        },
      ]),
    ),
  })
  await page.getByRole('button', { name: 'Validate and import' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Statistics imported.' })).toBeVisible()
  await row.getByRole('checkbox').check()
  await page.getByLabel('New pool name', { exact: true }).fill(`Browser pool ${Date.now()}`)
  await page.getByRole('button', { name: 'Create pool', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save selected players' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Validate and publish pool' })).toBeDisabled()
  await page.getByRole('button', { name: 'Save selected players' }).click()
  await expect(page.getByRole('button', { name: 'Validate and publish pool' })).toBeEnabled()
  await page.getByRole('button', { name: 'Validate and publish pool' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Player pool published.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save selected players' })).toBeDisabled()
  await expect(page.getByText('pool.publish', { exact: false }).first()).toBeVisible()
  for (const width of [1440, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.screenshot({
      path: `/private/tmp/sports-fanatics-qa/admin-${width}.png`,
      fullPage: true,
    })
    const dimensions = await page.evaluate(() => ({
      width: innerWidth,
      content: document.documentElement.scrollWidth,
    }))
    expect(
      dimensions.content,
      `Viewport ${width}: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.width)
  }
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Administrator sign-in' })).toBeVisible()
})

test('ordinary Firebase users cannot open admin tools', async ({ page, request }) => {
  test.skip(!connected, 'Requires local Firebase Auth emulator and PostgreSQL API')
  const email = `ordinary-${Date.now()}@example.test`
  const password = 'local-password-only'
  const signup = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
    {
      data: { email, password, returnSecureToken: true },
    },
  )
  const token = (await signup.json()).idToken
  await page.goto('/#/admin')
  await page.getByLabel('Email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Administrator access required' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Add player' })).toHaveCount(0)
  const denied = await request.get(`${process.env.ADMIN_TEST_API}/api/v1/admin/imports`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(denied.status()).toBe(403)
})
