import affiliations from './player-affiliations.json' with { type: 'json' }

const verified = new Date(affiliations.verifiedAt).toLocaleDateString(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export const NBA_AFFILIATION_CONTEXT = `${affiliations.season.replace('-', '/')} NBA teams · verified ${verified}`
export const SAMPLE_STATS_CONTEXT = `${affiliations.statisticsSeason.replace('-', '/')} sample statistics`
