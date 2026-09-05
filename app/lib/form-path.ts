export function getByPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

export function setByPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = path.split('.')
  const out = { ...obj }
  let cur: Record<string, unknown> = out
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!
    const next = cur[part]
    const cloned =
      next != null && typeof next === 'object' && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : {}
    cur[part] = cloned
    cur = cloned
  }
  cur[parts[parts.length - 1]!] = value
  return out
}

export function applyFieldDefaults(
  data: Record<string, unknown>,
  fields: Array<{ key: string; default?: unknown; defaultValue?: unknown }>,
): Record<string, unknown> {
  let out = { ...data }
  for (const field of fields) {
    const def = field.defaultValue ?? field.default
    if (def === undefined) continue
    const cur = getByPath(out, field.key)
    if (cur !== undefined && cur !== null && cur !== '') continue
    out = setByPath(out, field.key, def)
  }
  return out
}
