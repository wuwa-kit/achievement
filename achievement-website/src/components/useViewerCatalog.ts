import { useMemo } from 'react'
import { useViewerStore } from '../stores/viewer'
import { exclusiveAchievementGroups } from '../lib/catalog'
import { exclusionReason } from '../lib/exclusions'
import { getAchievementStages, getAchievementUnits, getExclusiveAchievements } from '../lib/data'

export function useViewerCatalog() {
  const data = useViewerStore((state) => state.data)
  const mainItems = useMemo(
    () => data?.achievements.filter((a) => a.inMainMenu && !exclusionReason(a)) ?? [],
    [data],
  )
  const stagesById = useMemo(() => getAchievementStages(mainItems), [mainItems])
  const exclusiveById = useMemo(
    () => getExclusiveAchievements(mainItems, exclusiveAchievementGroups),
    [mainItems],
  )
  const units = useMemo(
    () => getAchievementUnits(mainItems, exclusiveById),
    [mainItems, exclusiveById],
  )

  return { data, mainItems, stagesById, exclusiveById, units }
}

export type ViewerCatalog = ReturnType<typeof useViewerCatalog>
