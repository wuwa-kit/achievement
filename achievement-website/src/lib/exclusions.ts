import { tr } from '../i18n/index.ts'
import { z } from 'zod'
import configuration from '../../../data/achievement-exclusions.json' with { type: 'json' }
import type { Achievement } from './data.ts'

const reasonSchema = z.enum([
  'deprecated',
  'duplicate',
  'missingTrigger',
  'unavailableWithoutProgress',
])
export type ExclusionReason = z.infer<typeof reasonSchema>

const common = {
  id: z.number().int().positive(),
  reason: reasonSchema,
  duplicateOf: z.number().int().positive().optional(),
}
const rule = z.discriminatedUnion('condition', [
  z.object({ ...common, condition: z.literal('always') }).strict(),
  z.object({ ...common, condition: z.literal('missingProgress') }).strict(),
  z
    .object({
      ...common,
      condition: z.literal('titleEquals'),
      language: z.string().min(1),
      title: z.string().min(1),
    })
    .strict(),
])
const config = z
  .object({ version: z.literal(1), rules: z.array(rule) })
  .strict()
  .parse(configuration)
if (new Set(config.rules.map((rule) => rule.id)).size !== config.rules.length)
  throw new Error(tr('ui.exclusionDuplicate'))
const rules = new Map(config.rules.map((rule) => [rule.id, rule]))

export function getDuplicateAchievementId(id: number): number | undefined {
  return rules.get(id)?.duplicateOf
}

export function exclusionReason(item: Achievement): ExclusionReason | null {
  const rule = rules.get(item.id)
  if (!rule) return null
  const matches =
    rule.condition === 'always' ||
    (rule.condition === 'titleEquals' && item.texts[rule.language]?.title === rule.title) ||
    (rule.condition === 'missingProgress' &&
      item.status === 'unknown' &&
      item.currentProgress === null &&
      item.maxProgress === null &&
      item.hasGetReward !== true &&
      !(item.finishTimeRaw && item.finishTimeRaw > 0) &&
      !item.visibleForAccount)
  return matches ? rule.reason : null
}
