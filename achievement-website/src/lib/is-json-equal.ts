const isPrimitive = (value: unknown) => value === null || typeof value !== 'object'

export const isJsonEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (Number.isNaN(a) && Number.isNaN(b)) return true
  if (isPrimitive(a) || isPrimitive(b)) return a === b
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let index = 0; index < a.length; index++) {
      if (!isJsonEqual(a[index], b[index])) return false
    }
    return true
  }
  if (Array.isArray(a) && !Array.isArray(b)) return false
  if (Array.isArray(b) && !Array.isArray(a)) return false
  const a1 = a as Record<string, unknown>
  const b1 = b as Record<string, unknown>
  const keys = new Set([...Object.keys(a1), ...Object.keys(b1)])
  for (const key of keys) {
    if (!isJsonEqual(a1[key], b1[key])) return false
  }
  return true
}
