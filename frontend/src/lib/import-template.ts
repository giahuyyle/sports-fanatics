export function downloadImportTemplate(playerId = 'REPLACE_WITH_PLAYER_UUID') {
  const totals = Object.fromEntries(
    'games starts minutes points rebounds assists steals blocks turnovers fouls fg_made fg_attempted three_made three_attempted ft_made ft_attempted'
      .split(' ')
      .map((key) => [key, 0]),
  )
  const row = {
    player_id: playerId,
    season: new Date().getUTCFullYear() - (new Date().getUTCMonth() < 6 ? 1 : 0),
    phase: 'regular',
    scope: 'TOTAL',
    totals,
  }
  const url = URL.createObjectURL(
    new Blob([JSON.stringify([row], null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'career-import-template.json'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
