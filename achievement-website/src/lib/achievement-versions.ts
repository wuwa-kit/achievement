import versionData from '../../../data/achievement-versions.json' with { type: 'json' }

export const achievementVersionById = new Map(
  Object.entries(versionData).flatMap(([version, ids]) => ids.map((id) => [id, version] as const)),
)

export const achievementVersions = Object.keys(versionData).sort((a, b) =>
  b.localeCompare(a, 'en', { numeric: true }),
)
