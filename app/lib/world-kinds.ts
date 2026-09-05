export const WORLD_NODE_KIND_LABELS: Record<string, string> = {
  universe: '宇宙',
  multiverse: '多元宇宙',
  galaxy: '星系',
  star_cluster: '星团',
  star_system: '恒星系',
  nebula: '星云/星域',
  realm: '界域',
  domain: '域',
  plane: '位面',
  dimension: '维度',
  planet: '星球',
  satellite: '卫星',
  space_station: '空间站',
  mainland: '大陆',
  continent: '洲陆',
  ocean: '海域',
  region: '地区/州',
  mountain: '灵山/山脉',
  secret_realm: '秘境/禁地',
  country: '国家',
  empire: '帝国/皇朝',
  kingdom: '王国',
  federation: '联邦',
  city: '城市',
  town: '城镇',
  settlement: '聚落/据点',
  royal: '皇族/王族',
  sect: '宗门/门派',
  clan: '家族/氏族',
  guild: '公会/商会',
  army: '军团/卫队',
  fleet: '舰队',
  corporation: '公司/财团',
  faction: '势力',
  hall: '堂口',
  alliance: '联盟',
  cult: '教派/魔道',
  academy: '学院/传承',
  custom: '其他',
}

export const WORLD_NODE_KIND_GROUPS: Array<{ label: string; kinds: string[] }> = [
  {
    label: '宇宙层级',
    kinds: ['universe', 'multiverse', 'galaxy', 'star_cluster', 'star_system', 'nebula'],
  },
  {
    label: '修仙界域',
    kinds: ['realm', 'domain', 'plane', 'dimension'],
  },
  {
    label: '地理实体',
    kinds: [
      'planet',
      'satellite',
      'space_station',
      'mainland',
      'continent',
      'ocean',
      'region',
      'mountain',
      'secret_realm',
    ],
  },
  {
    label: '政区与聚落',
    kinds: ['country', 'empire', 'kingdom', 'federation', 'city', 'town', 'settlement'],
  },
  {
    label: '组织与势力',
    kinds: [
      'royal',
      'sect',
      'clan',
      'guild',
      'army',
      'fleet',
      'corporation',
      'faction',
      'hall',
      'alliance',
      'cult',
      'academy',
    ],
  },
  { label: '其他', kinds: ['custom'] },
]

export function suggestChildKind(parentKind: string | null | undefined): string {
  if (parentKind == null) return 'universe'
  switch (parentKind) {
    case 'universe':
      return 'galaxy'
    case 'multiverse':
      return 'universe'
    case 'galaxy':
      return 'star_system'
    case 'star_cluster':
      return 'star_system'
    case 'star_system':
      return 'planet'
    case 'nebula':
      return 'star_system'
    case 'realm':
      return 'domain'
    case 'domain':
      return 'mainland'
    case 'plane':
      return 'mainland'
    case 'dimension':
      return 'plane'
    case 'planet':
      return 'mainland'
    case 'satellite':
    case 'space_station':
      return 'settlement'
    case 'mainland':
      return 'country'
    case 'continent':
      return 'country'
    case 'ocean':
      return 'region'
    case 'region':
      return 'city'
    case 'mountain':
      return 'sect'
    case 'secret_realm':
      return 'custom'
    case 'country':
      return 'city'
    case 'empire':
    case 'kingdom':
    case 'federation':
      return 'region'
    case 'city':
    case 'settlement':
      return 'faction'
    case 'town':
      return 'guild'
    case 'royal':
    case 'sect':
    case 'clan':
    case 'guild':
    case 'army':
    case 'fleet':
    case 'corporation':
    case 'faction':
    case 'alliance':
    case 'cult':
      return 'hall'
    case 'hall':
      return 'custom'
    case 'academy':
      return 'sect'
    default:
      return 'custom'
  }
}

export function emptyWorldNodeDetail(): Record<string, string> {
  return { geography: '', culture: '', history: '', factions: '' }
}
