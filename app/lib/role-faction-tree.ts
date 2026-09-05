export type EntityRow = Record<string, unknown> & {
  id?: string
  name?: string
  kind?: string
  parentId?: string | null
  faction?: string
  sortOrder?: number
}

export const UNASSIGNED_FACTION_KEY = 'faction:__unassigned__'
export const UNASSIGNED_LABEL = '未归属'

export type RoleFactionTreeNode = {
  key: string
  value: string
  label: string
  selectable?: boolean
  count?: number
  children?: RoleFactionTreeNode[]
}

export type AffiliationOption = {
  label: string
  value: string
  group: '势力' | '城市'
}

const CITY_KINDS = new Set(['city', 'town', 'settlement'])

export function worldFactionNames(nodes: EntityRow[]): string[] {
  const set = new Set<string>()
  for (const n of nodes) {
    if (n.kind !== 'faction') continue
    const name = String(n.name ?? '').trim()
    if (name) set.add(name)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function worldCityNames(nodes: EntityRow[]): string[] {
  const set = new Set<string>()
  for (const n of nodes) {
    if (!CITY_KINDS.has(String(n.kind ?? ''))) continue
    const name = String(n.name ?? '').trim()
    if (name) set.add(name)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function worldAffiliationOptions(nodes: EntityRow[]): AffiliationOption[] {
  return [
    ...worldFactionNames(nodes).map((n) => ({ label: n, value: n, group: '势力' as const })),
    ...worldCityNames(nodes).map((n) => ({ label: n, value: n, group: '城市' as const })),
  ]
}

export function factionGroupKey(name: string): string {
  return `faction:${name}`
}

export function cityGroupKey(name: string): string {
  return `city:${name}`
}

export function isRoleGroupKey(key: string): boolean {
  return key.startsWith('faction:') || key.startsWith('city:')
}

export function buildRoleFactionTreeData(roles: EntityRow[], worldNodes: EntityRow[]): RoleFactionTreeNode[] {
  const factionNames = worldFactionNames(worldNodes)
  const cityNames = worldCityNames(worldNodes)
  const factionSet = new Set(factionNames)
  const citySet = new Set(cityNames)

  const byFaction = new Map<string, EntityRow[]>()
  const byCity = new Map<string, EntityRow[]>()
  for (const name of factionNames) byFaction.set(name, [])
  for (const name of cityNames) byCity.set(name, [])

  const unassigned: EntityRow[] = []
  const orphan: EntityRow[] = []

  for (const role of roles) {
    const f = String(role.faction ?? '').trim()
    if (!f) {
      unassigned.push(role)
    } else if (factionSet.has(f)) {
      const list = byFaction.get(f) ?? []
      list.push(role)
      byFaction.set(f, list)
    } else if (citySet.has(f)) {
      const list = byCity.get(f) ?? []
      list.push(role)
      byCity.set(f, list)
    } else {
      orphan.push(role)
    }
  }

  const roleNode = (role: EntityRow): RoleFactionTreeNode => ({
    key: String(role.id),
    value: String(role.id),
    label: String(role.name ?? '').trim() || '未命名',
    selectable: true,
  })

  const sortRoles = (list: EntityRow[]) =>
    [...list].sort(
      (a, b) =>
        Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-CN'),
    )

  const nodes: RoleFactionTreeNode[] = []

  for (const name of factionNames) {
    const children = sortRoles(byFaction.get(name) ?? []).map(roleNode)
    nodes.push({
      key: factionGroupKey(name),
      value: factionGroupKey(name),
      label: `势力 · ${name}`,
      selectable: false,
      count: children.length,
      children: children.length > 0 ? children : undefined,
    })
  }

  for (const name of cityNames) {
    const children = sortRoles(byCity.get(name) ?? []).map(roleNode)
    if (children.length === 0) continue
    nodes.push({
      key: cityGroupKey(name),
      value: cityGroupKey(name),
      label: `城市 · ${name}`,
      selectable: false,
      count: children.length,
      children,
    })
  }

  if (orphan.length > 0) {
    const children = sortRoles(orphan).map(roleNode)
    nodes.push({
      key: 'faction:__orphan__',
      value: 'faction:__orphan__',
      label: '无效归属',
      selectable: false,
      count: children.length,
      children,
    })
  }

  if (unassigned.length > 0) {
    const children = sortRoles(unassigned).map(roleNode)
    nodes.push({
      key: UNASSIGNED_FACTION_KEY,
      value: UNASSIGNED_FACTION_KEY,
      label: UNASSIGNED_LABEL,
      selectable: false,
      count: children.length,
      children,
    })
  }

  return nodes
}
