import roleRequirements from '../../../data/achievement-role-requirements.json' with { type: 'json' }
import roleData from '../../../data/roles.json' with { type: 'json' }

type Role = {
  id: number
  names: Record<string, string | null>
  avatarUrl: string
}

type RoleRequirement = {
  roleIds: number[]
  requirement: string
}

const roles: Partial<Record<number, Role>> = roleData.roles
const requirements: Partial<Record<number, RoleRequirement>> = {
  ...roleRequirements.modeAchievements,
  ...roleRequirements.achievements,
}

// Pick one gender for the lifetime of the page. The pairs are male and female for each element.
const useMaleRoverAvatar = Math.random() < 0.5
const preferredRoverRoleIds = new Map<number, number>(
  [
    [1501, 1502],
    [1605, 1604],
    [1406, 1408],
    [1309, 1310],
  ].map(([male, female]) => (useMaleRoverAvatar ? [female, male] : [male, female])),
)

export function getAchievementRoles(id: number, language: string) {
  const requirement = requirements[id]
  if (!requirement) return

  const eligibleRoles = requirement.roleIds.flatMap((roleId) => {
    const role = roles[roleId]
    return role ? [role] : []
  })
  if (eligibleRoles.length === 0) return

  const names = [...new Set(eligibleRoles.map(({ names }) => names[language] ?? names.en))].filter(
    (name) => name !== null,
  )
  const value0 = new Intl.ListFormat(language, { type: 'disjunction' }).format(names)
  const requirementKey = Object.hasOwn(roleRequirements.modeAchievements, id)
    ? 'ui.achievementModeRole'
    : requirement.requirement === 'interactWithDreamingCharacter'
      ? 'ui.achievementInteractionRole'
      : 'ui.achievementRequiredRole'

  const avatars = eligibleRoles.filter(({ id: roleId }) => {
    const preferredId = preferredRoverRoleIds.get(roleId)
    return preferredId === undefined || !eligibleRoles.some(({ id }) => id === preferredId)
  })
  return { avatars, requirementKey, value0 }
}
