import type { EntityRow } from '@/app/lib/role-faction-tree'
import {
  worldCityNames,
  worldFactionNames,
  UNASSIGNED_LABEL,
} from '@/app/lib/role-faction-tree'

export function normalizeManageTreeFilterQuery(query: string): string {
  return query.trim().toLowerCase()
}

export function matchesManageTreeFilter(haystack: string, query: string): boolean {
  const q = normalizeManageTreeFilterQuery(query)
  if (!q) return true
  return haystack.toLowerCase().includes(q)
}

export function filterFlatList<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
): T[] {
  const q = normalizeManageTreeFilterQuery(query)
  if (!q) return items
  return items.filter((item) => matchesManageTreeFilter(getSearchText(item), q))
}

export function filterWorldNodesForTree(nodes: EntityRow[], query: string): EntityRow[] {
  const q = normalizeManageTreeFilterQuery(query)
  if (!q) return nodes

  const byId = new Map(nodes.map((n) => [String(n.id), n]))
  const keepIds = new Set<string>()

  for (const node of nodes) {
    if (!matchesManageTreeFilter(String(node.name ?? ''), q)) continue
    let current: EntityRow | undefined = node
    while (current) {
      keepIds.add(String(current.id))
      const parentId = current.parentId ? String(current.parentId) : null
      current = parentId ? byId.get(parentId) : undefined
    }
  }

  return nodes.filter((n) => keepIds.has(String(n.id)))
}

export function filterRolesForTree(roles: EntityRow[], query: string, worldNodes: EntityRow[]): EntityRow[] {
  const q = normalizeManageTreeFilterQuery(query)
  if (!q) return roles

  const factionNames = worldFactionNames(worldNodes)
  const cityNames = worldCityNames(worldNodes)
  const factionSet = new Set(factionNames)
  const citySet = new Set(cityNames)

  const matchingFactionSet = new Set(factionNames.filter((name) => matchesManageTreeFilter(name, q)))
  const matchingCitySet = new Set(cityNames.filter((name) => matchesManageTreeFilter(name, q)))

  for (const name of factionNames) {
    if (matchesManageTreeFilter(`势力 · ${name}`, q)) matchingFactionSet.add(name)
  }
  for (const name of cityNames) {
    if (matchesManageTreeFilter(`城市 · ${name}`, q)) matchingCitySet.add(name)
  }

  if (matchesManageTreeFilter(UNASSIGNED_LABEL, q)) {
    return roles.filter((r) => !String(r.faction ?? '').trim())
  }
  if (matchesManageTreeFilter('无效归属', q)) {
    return roles.filter((r) => {
      const f = String(r.faction ?? '').trim()
      return f && !factionSet.has(f) && !citySet.has(f)
    })
  }

  return roles.filter((role) => {
    const name = String(role.name ?? '').trim() || '未命名'
    const faction = String(role.faction ?? '').trim()
    if (matchesManageTreeFilter(name, q)) return true
    if (faction && matchesManageTreeFilter(faction, q)) return true
    if (faction && matchingFactionSet.has(faction)) return true
    if (faction && matchingCitySet.has(faction)) return true
    return false
  })
}
