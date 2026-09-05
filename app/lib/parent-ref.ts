export type ParentRefItem = {
  id?: unknown
  name?: unknown
  title?: unknown
  parentId?: unknown
}

export function itemKey(item: ParentRefItem): string {
  return String(item.id ?? '').trim()
}

export function itemLabel(item: ParentRefItem): string {
  const name = String(item.name ?? item.title ?? '').trim()
  return name || '未命名'
}

/** Resolve parentId from API (UUID or natural name) to canonical item id. */
export function resolveParentId(items: ParentRefItem[], parentRef: unknown): string | null {
  if (parentRef == null) return null
  const ref = String(parentRef).trim()
  if (!ref) return null

  for (const item of items) {
    if (itemKey(item) === ref) return itemKey(item)
  }
  for (const item of items) {
    if (itemLabel(item) === ref) return itemKey(item)
  }
  return null
}

export function isDirectChildOf(
  items: ParentRefItem[],
  item: ParentRefItem,
  parentKey: string | null,
): boolean {
  const resolved = resolveParentId(items, item.parentId)
  if (parentKey == null) return resolved == null
  return resolved === parentKey
}
