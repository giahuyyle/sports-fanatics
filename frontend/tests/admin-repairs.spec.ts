import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function adminFixture(
  page: Page,
  options: {
    slow?: boolean
    failPool?: boolean
    failAudit?: boolean
    failPermission?: boolean
    html?: boolean
    validation?: boolean
  } = {},
) {
  const writes: { path: string; body: unknown }[] = []
  const players = Array.from({ length: 123 }, (_, index) => ({
    id: `player-${index}`,
    name:
      index === 0
        ? 'Alice Alpha'
        : index === 1
          ? 'Bob Beta'
          : index === 2
            ? 'Archived Charlie'
            : `Catalog player ${String(index).padStart(3, '0')}`,
    rookie_season: 2026,
    no_appearances: true,
    archived: index === 2,
    tier: 1,
    priority: index,
    positions: ['PG'],
    nba_team_id: null,
    external_ids: {},
    coverage: { complete: true, no_appearances: true, missing_seasons: [] },
  }))
  const pools = [
    { id: 'a', name: 'Pool A', status: 'draft' },
    { id: 'b', name: 'Pool B', status: 'draft' },
    { id: 'published', name: 'Published pool', status: 'published' },
    { id: 'archived', name: 'Archived selection', status: 'draft' },
  ]
  const selections: Record<string, string[]> = {
    a: ['player-0'],
    b: ['player-1'],
    published: ['player-0'],
    archived: ['player-2', 'player-0'],
  }
  await page.route('**/src/lib/firebase.ts*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export const adminAuth = { currentUser: { uid: 'fixture-admin', email: 'fixture@example.test', getIdToken: async () => 'mock-token' } };`,
    }),
  )
  await page.route('**/node_modules/.vite/deps/firebase_auth.js*', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export class GoogleAuthProvider {} export function onAuthStateChanged(auth, cb) { queueMicrotask(() => cb(auth.currentUser)); return () => {}; } export const signInWithEmailAndPassword = async () => {}; export const signInWithPopup = async () => {}; export const signOut = async () => {};`,
    }),
  )
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace('/api/v1', '')
    if (request.method() !== 'GET') {
      writes.push({ path, body: request.postDataJSON() })
      if (options.validation)
        return route.fulfill({
          status: 422,
          json: {
            error: {
              code: 'invalid_request',
              message: 'Request validation failed.',
              details: [
                {
                  loc: ['body', 'rookie_season'],
                  message: 'Rookie season cannot be in the future',
                },
              ],
            },
          },
        })
      if (options.slow) await new Promise((resolve) => setTimeout(resolve, 600))
      if (path.endsWith('/players') && path.includes('/pools/'))
        selections[path.split('/')[3]] = request.postDataJSON().player_ids
      if (path.endsWith('/publish'))
        pools.find((pool) => pool.id === path.split('/')[3])!.status = 'published'
      return route.fulfill({ json: { id: 'new-pool', status: 'draft' } })
    }
    if (path === '/me') {
      if (options.failPermission)
        return route.fulfill({
          status: 503,
          json: { error: { message: 'Permission service unavailable', code: 'unavailable' } },
        })
      return route.fulfill({ json: { is_admin: true } })
    }
    if (path === '/admin/players') {
      if (options.html)
        return route.fulfill({
          status: 502,
          contentType: 'text/html',
          body: '<html>Bad Gateway</html>',
        })
      const offset = Number(url.searchParams.get('offset') || 0),
        limit = Number(url.searchParams.get('limit') || 50),
        query = (url.searchParams.get('search') || '').toLowerCase()
      const result = players.filter((player) => player.name.toLowerCase().includes(query))
      return route.fulfill({
        json: { items: result.slice(offset, offset + limit), total: result.length, offset, limit },
      })
    }
    if (path === '/pools') return route.fulfill({ json: pools })
    if (path.startsWith('/pools/')) {
      const id = path.split('/').at(-1)!
      if (options.slow) await new Promise((resolve) => setTimeout(resolve, 600))
      if (options.failPool && id === 'b')
        return route.fulfill({ status: 503, json: { error: { message: 'Pool unavailable' } } })
      return route.fulfill({
        json: { players: (selections[id] ?? []).map((id) => ({ player_id: id })) },
      })
    }
    if (path === '/nba-teams')
      return route.fulfill({ json: [{ id: 'chicago', code: 'CHI', name: 'Chicago Bulls' }] })
    if (path.endsWith('/history'))
      return route.fulfill({
        json: {
          seasons: [
            {
              season: 2025,
              phase: 'regular',
              scope: 'TOTAL',
              totals: { games: 10 },
              averages: { points: 5, rebounds: 2, assists: null },
            },
          ],
        },
      })
    if (path.startsWith('/players/'))
      return route.fulfill({ json: players.find((p) => p.id === path.split('/').at(-1)) })
    if (path === '/admin/audit' && options.failAudit)
      return route.fulfill({
        status: 503,
        json: { error: { message: 'Audit history unavailable' } },
      })
    return route.fulfill({ json: [] })
  })
  await page.goto('/#/admin')
  if (!options.failPermission)
    await page.getByRole('heading', { name: 'Player catalog', exact: true }).waitFor()
  if (!options.failPermission && !options.html)
    await expect(page.locator('.admin-table tbody tr')).toHaveCount(50)
  return { writes, players, pools, selections }
}

test('admin pool transitions cannot race or use a failed target', async ({ page }) => {
  await adminFixture(page, { slow: true, failPool: true })
  const select = page.getByRole('combobox', { name: 'Pool version', exact: true })
  await select.selectOption('a')
  await expect(select).toBeDisabled()
  await expect(select).toBeEnabled()
  await select.selectOption('b')
  await expect(page.getByRole('alert')).toContainText('Pool unavailable')
  await expect(select).toHaveValue('a')
  await expect(
    page.getByRole('checkbox', { name: 'Select Alice Alpha', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('checkbox', { name: 'Select Bob Beta', exact: true }),
  ).not.toBeChecked()
})

test('saving freezes conflicting selection and editor actions', async ({ page }) => {
  const { writes } = await adminFixture(page, { slow: true })
  await page.getByRole('combobox', { name: 'Pool version', exact: true }).selectOption('a')
  await expect(page.getByRole('button', { name: 'Save selected players' })).toBeEnabled()
  await page.getByRole('button', { name: 'Save selected players' }).click()
  await expect(page.getByRole('checkbox', { name: 'Select Bob Beta', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Edit Bob Beta', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Validate and publish pool' })).toBeEnabled()
  expect(writes[0].body).toEqual({ player_ids: ['player-0'] })
  await page.getByRole('button', { name: 'Edit Alice Alpha', exact: true }).click()
  await page.getByRole('button', { name: 'Save player', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Edit Bob Beta', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Player name', { exact: true })).toBeDisabled()
  await expect(page.getByRole('status').filter({ hasText: 'Player saved.' })).toBeVisible()
})

test('archived selections can be removed and published pools are immutable', async ({ page }) => {
  await adminFixture(page)
  const select = page.getByRole('combobox', { name: 'Pool version', exact: true })
  await select.selectOption('archived')
  const archived = page.getByRole('checkbox', { name: 'Select Archived Charlie', exact: true })
  await expect(archived).toBeChecked()
  await expect(archived).toBeEnabled()
  await archived.uncheck()
  await page.getByRole('button', { name: 'Save selected players' }).click()
  await expect(page.getByRole('button', { name: 'Validate and publish pool' })).toBeEnabled()
  await select.selectOption('published')
  await expect(page.getByRole('checkbox', { name: 'Select Bob Beta', exact: true })).toBeDisabled()
})

test('dirty pool changes require explicit discard on pool switch and navigation', async ({
  page,
}) => {
  await adminFixture(page)
  const select = page.getByRole('combobox', { name: 'Pool version', exact: true })
  await select.selectOption('a')
  await page.getByRole('checkbox', { name: 'Select Bob Beta', exact: true }).check()
  page.once('dialog', (dialog) => dialog.dismiss())
  await select.selectOption('b')
  await expect(select).toHaveValue('a')
  await expect(page.getByRole('checkbox', { name: 'Select Bob Beta', exact: true })).toBeChecked()
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page).toHaveURL(/#\/admin/)
})

test('pagination preserves selection and read failures do not erase data or successful writes', async ({
  page,
}) => {
  await adminFixture(page, { failAudit: true })
  await expect(page.getByText('Audit history: Audit history unavailable')).toBeVisible()
  await page.getByRole('checkbox', { name: 'Select Alice Alpha', exact: true }).check()
  await page.getByRole('button', { name: 'Next players', exact: true }).click()
  await expect(page.getByText('Showing 51–100 of 123 players.')).toBeVisible()
  await page.getByRole('button', { name: 'Previous players', exact: true }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Select Alice Alpha', exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Edit Alice Alpha', exact: true }).click()
  await page.getByRole('button', { name: 'Save player', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Player saved.' })).toBeVisible()
  await expect(page.getByText('Audit history: Audit history unavailable')).toBeVisible()
})

test('player metadata, history and import preparation are inspectable', async ({ page }) => {
  await adminFixture(page)
  await page.getByRole('button', { name: 'Edit Alice Alpha', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'NBA team', exact: true })).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Provider IDs (JSON)', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'History for Alice Alpha', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('2025/26')
  await expect(page.getByRole('cell', { name: '5.0', exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download import template', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('career-import-template.json')
})

test('permission outages and HTML gateway errors have useful recovery states', async ({ page }) => {
  await adminFixture(page, { failPermission: true })
  await expect(
    page.getByRole('heading', { name: 'Unable to check administrator access', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry access check' })).toBeVisible()
})

test('non-JSON catalog errors retain a retryable panel state', async ({ page }) => {
  await adminFixture(page, { html: true })
  await expect(
    page.getByRole('alert').filter({ hasText: 'unreadable response (502)' }),
  ).toBeVisible()
  await expect(
    page.getByText('No players found. Try another search or add a player above.'),
  ).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Retry loading panels' })).toBeVisible()
})

test('field validation errors identify the field and retain the editor', async ({ page }) => {
  await adminFixture(page, { validation: true })
  await page.getByRole('button', { name: 'Edit Alice Alpha', exact: true }).click()
  await page.getByRole('button', { name: 'Save player', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(
    'rookie_season: Rookie season cannot be in the future',
  )
  await expect(page.getByRole('textbox', { name: 'Player name', exact: true })).toHaveValue(
    'Alice Alpha',
  )
})
