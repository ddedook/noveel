import type {
  DomainDescription,
  DomainFieldDesc,
  EntityDef,
  EntityDomain,
  FormTemplateConfig,
  FormTemplateField,
  JsonField,
  ScalarField,
} from './entity-types'

export const ENTITY_DOMAINS: EntityDomain[] = [
  'overview',
  'role',
  'roleRelation',
  'roleTimeline',
  'creature',
  'creatureTimeline',
  'item',
  'itemTimeline',
  'level',
  'world',
  'worldTimeline',
  'timeline',
  'outline',
  'chapter',
  'skill',
]

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

export const WORLD_KINDS = Object.keys(WORLD_NODE_KIND_LABELS) as readonly string[]

export const WORLD_KIND_ALIASES: Record<string, string> = {
  fortress: 'settlement',
  base: 'settlement',
  camp: 'settlement',
  outpost: 'settlement',
  stronghold: 'settlement',
  village: 'town',
  wilderness: 'region',
  wild: 'region',
  wasteland: 'region',
  forest: 'region',
  district: 'region',
  province: 'region',
  state: 'region',
  company: 'corporation',
  corp: 'corporation',
  firm: 'corporation',
  solar_system: 'star_system',
  starsystem: 'star_system',
  earth: 'planet',
  组织: 'faction',
  势力: 'faction',
  堂口: 'hall',
  branch_hall: 'hall',
  tang: 'hall',
  城市: 'city',
  城镇: 'town',
  国家: 'country',
  宗门: 'sect',
  家族: 'clan',
  大陆: 'mainland',
  地区: 'region',
  星球: 'planet',
  秘境: 'secret_realm',
}

export const TIMELINE_EVENT_TYPES = [
  'plot',
  'conflict',
  'suspense',
  'foreshadow',
  'turning',
  'resolution',
  'other',
] as const

export const TIMELINE_EVENT_TYPE_LABELS: Record<string, string> = {
  plot: '主线推进',
  conflict: '冲突',
  suspense: '悬念',
  foreshadow: '伏笔',
  turning: '转折',
  resolution: '收束/解决',
  other: '其他',
}

export const SKILL_SECTIONS = [
  'overview',
  'role',
  'creature',
  'level',
  'world',
  'timeline',
  'outline',
  'chapters',
  'item',
] as const

export const CREATURE_KINDS = ['animal', 'beast', 'plant', 'spirit', 'other'] as const

export const CREATURE_KIND_LABELS: Record<string, string> = {
  animal: '动物',
  beast: '异兽',
  plant: '植物',
  spirit: '灵体',
  other: '其他',
}

export const WORLD_DETAIL_KEYS = ['geography', 'culture', 'history', 'factions'] as const
export const LEVEL_SYSTEM_KEYS = ['name', 'category', 'description', 'levels'] as const

function timelineScalars(owner: {
  key: string
  column: string
  label: string
  domain: EntityDomain
}): ScalarField[] {
  return [
    {
      key: owner.key,
      column: owner.column,
      type: 'ref',
      label: owner.label,
      required: true,
      ref: { domain: owner.domain, resolveBy: 'name' },
      inIndex: true,
      description: `所属${owner.label}，可直接传名称由系统解析为 id`,
    },
    {
      key: 'timeLabel',
      column: 'time_label',
      type: 'text',
      label: '时间标签',
      required: true,
      inIndex: true,
      description: '人类可读的时间描述，如「开篇前三年」',
    },
    {
      key: 'timePoint',
      column: 'time_point',
      type: 'int',
      label: '时间点',
      required: true,
      inIndex: true,
      ddl: 'BIGINT',
      description: '排序用有符号整数，越大越靠后；同一所属对象内唯一',
    },
    { key: 'title', column: 'title', type: 'text', label: '事件标题', inIndex: true },
    {
      key: 'content',
      column: 'content',
      type: 'longText',
      label: '事件内容',
      truncateAt: 4000,
      required: true,
    },
    {
      key: 'relatedChapterNo',
      column: 'related_chapter_id',
      type: 'ref',
      label: '关联章节',
      nullable: true,
      ref: { domain: 'chapter', resolveBy: 'chapterNo' },
      description: '传章号正整数，不要传 UUID',
    },
    { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
  ]
}

export const ENTITY_REGISTRY: Record<EntityDomain, EntityDef> = {
  overview: {
    domain: 'overview',
    label: '概述',
    description:
      '小说核心蓝图，一本书一份。所有其他数据都围绕它展开，字段完全由表单模板 overview.fields 定义。',
    storage: { kind: 'novelColumn', table: 'novel_blueprint', column: 'blueprint_json' },
    singleton: true,
    section: 'overview',
    scalars: [],
    json: [
      {
        key: 'blueprint',
        column: 'blueprint_json',
        label: '概述内容',
        templatePath: 'overview.fields',
        merge: 'deepMerge',
      },
    ],
    businessKey: [],
    quality: { minJsonFilled: 4 },
  },
  role: {
    domain: 'role',
    label: '人物',
    description:
      '书中人物档案，按名称唯一。归属用标量 faction：有势力则填世界已有势力（kind=faction）的 name；无势力则填世界已有城市（kind=city|town|settlement）的 name，二者均须中文全等且节点已存在。筛选：queryEntities where.faction；改归属：mutateEntities data.faction；清空传空字符串。详情字段由表单模板 role.detailFields 定义。',
    storage: { kind: 'perNovelTable', base: 'novel_roles' },
    section: 'role',
    scalars: [
      { key: 'name', column: 'name', type: 'text', label: '人物名', required: true, inIndex: true },
      {
        key: 'faction',
        column: 'faction',
        type: 'text',
        label: '所属势力 / 城市',
        nullable: true,
        inIndex: true,
        description:
          '有势力：填世界 kind=faction 的 name；无势力：填世界 city/town/settlement 的 name。均须已在世界页存在，禁止自造。可空但不推荐（无势力时应挂城市）。筛选 where.faction；清空传 ""。',
      },
      { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
    ],
    json: [
      {
        key: 'profile',
        column: 'profile_json',
        label: '人物档案',
        templatePath: 'role.detailFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['name'],
    sortField: 'sortOrder',
    indexHintKeys: ['定位', '身份', '简介', 'brief', 'identity', 'faction'],
    quality: { minRows: 2, minJsonFilled: 3 },
  },
  roleRelation: {
    domain: 'roleRelation',
    label: '人物关系',
    description: '两个人物之间的有向关系。写入时系统自动补齐反向边，保证 A→B 与 B→A 同时存在。',
    storage: { kind: 'perNovelTable', base: 'novel_role_relations' },
    section: 'role',
    scalars: [
      {
        key: 'fromRoleId',
        column: 'from_role_id',
        type: 'ref',
        label: '关系起点',
        required: true,
        ref: { domain: 'role', resolveBy: 'name' },
        inIndex: true,
      },
      {
        key: 'toRoleId',
        column: 'to_role_id',
        type: 'ref',
        label: '关系终点',
        required: true,
        ref: { domain: 'role', resolveBy: 'name' },
        inIndex: true,
      },
      {
        key: 'relationType',
        column: 'relation_type',
        type: 'text',
        label: '关系类型',
        required: true,
        inIndex: true,
        description: '如师徒、宿敌、同门',
      },
      { key: 'content', column: 'content', type: 'longText', label: '关系描述', truncateAt: 4000 },
    ],
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '关系扩展字段',
        templatePath: 'role.relation.extraFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['fromRoleId', 'toRoleId'],
    effects: ['bidirectionalRelation'],
  },
  roleTimeline: {
    domain: 'roleTimeline',
    label: '人物时间线',
    description: '某个人物身上发生的事件，按「人物 + 时间点」唯一。',
    storage: { kind: 'perNovelTable', base: 'novel_role_timeline' },
    section: 'role',
    scalars: timelineScalars({ key: 'roleId', column: 'role_id', label: '人物', domain: 'role' }),
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '时间线扩展字段',
        templatePath: 'role.timeline.extraFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['roleId', 'timePoint'],
    sortField: 'sortOrder',
  },
  creature: {
    domain: 'creature',
    label: '生物',
    description:
      '除人物外的生物档案（动物、异兽、通灵植物、灵体等），按名称唯一。kind 为标量枚举 animal|beast|plant|spirit|other（默认 other）。主人 owner 可选，存人物名字符串（非 id）；无主则省略或传空。详情字段由表单模板 creature.detailFields 定义（勿在 profile 再写 kind）。',
    storage: { kind: 'perNovelTable', base: 'novel_creatures' },
    section: 'creature',
    scalars: [
      { key: 'name', column: 'name', type: 'text', label: '生物名', required: true, inIndex: true },
      {
        key: 'kind',
        column: 'kind',
        type: 'enum',
        label: '种类',
        required: true,
        values: CREATURE_KINDS,
        valueLabels: CREATURE_KIND_LABELS,
        default: 'other',
        inIndex: true,
        description: 'animal=动物 beast=异兽 plant=植物 spirit=灵体 other=其他；缺省 other',
      },
      {
        key: 'owner',
        column: 'owner',
        type: 'text',
        label: '主人',
        nullable: true,
        inIndex: true,
        description: '可选。存人物名称字符串，不存 role id；无主省略或传空。',
      },
      { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
    ],
    json: [
      {
        key: 'profile',
        column: 'profile_json',
        label: '生物档案',
        templatePath: 'creature.detailFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['name'],
    sortField: 'sortOrder',
    indexHintKeys: ['kind', 'habitat', 'ability'],
    quality: { minJsonFilled: 2 },
  },
  creatureTimeline: {
    domain: 'creatureTimeline',
    label: '生物时间线',
    description: '某生物的经历与状态变化，按「生物 + 时间点」唯一。',
    storage: { kind: 'perNovelTable', base: 'novel_creature_timeline' },
    section: 'creature',
    scalars: timelineScalars({
      key: 'creatureId',
      column: 'creature_id',
      label: '生物',
      domain: 'creature',
    }),
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '时间线扩展字段',
        templatePath: 'creature.timeline.extraFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['creatureId', 'timePoint'],
    sortField: 'sortOrder',
  },
  item: {
    domain: 'item',
    label: '物品',
    description:
      '书中物品档案，按名称唯一。主人 owner 可选，存人物名字符串。详情字段由表单模板 item.detailFields 定义。',
    storage: { kind: 'perNovelTable', base: 'novel_items' },
    section: 'item',
    scalars: [
      { key: 'name', column: 'name', type: 'text', label: '物品名', required: true, inIndex: true },
      {
        key: 'owner',
        column: 'owner',
        type: 'text',
        label: '主人',
        nullable: true,
        inIndex: true,
        description: '可选。存人物名称字符串，不存 role id；无主省略或传空。',
      },
      { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
    ],
    json: [
      {
        key: 'profile',
        column: 'profile_json',
        label: '物品档案',
        templatePath: 'item.detailFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['name'],
    sortField: 'sortOrder',
    indexHintKeys: ['type', 'weaponry', 'grade'],
    quality: { minJsonFilled: 2 },
  },
  itemTimeline: {
    domain: 'itemTimeline',
    label: '物品时间线',
    description: '某件物品的流转与变化事件，按「物品 + 时间点」唯一。',
    storage: { kind: 'perNovelTable', base: 'novel_item_timeline' },
    section: 'item',
    scalars: timelineScalars({ key: 'itemId', column: 'item_id', label: '物品', domain: 'item' }),
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '时间线扩展字段',
        templatePath: 'item.timeline.extraFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['itemId', 'timePoint'],
    sortField: 'sortOrder',
  },
  level: {
    domain: 'level',
    label: '等级体系',
    description:
      '力量/修炼/品阶体系，按体系名称唯一。可以是人物境界，也可以是物品品阶，靠体系名称区分。',
    storage: { kind: 'perNovelTable', base: 'novel_level_systems' },
    section: 'level',
    scalars: [
      {
        key: 'presetId',
        column: 'preset_id',
        type: 'text',
        label: '预设来源',
        nullable: true,
        readOnly: true,
      },
    ],
    json: [
      {
        key: 'system',
        column: 'system_json',
        label: '体系定义',
        shape: 'levelSystem',
        templatePath: 'level.levelFields',
        merge: 'levelTiers',
        description:
          '含 name / category / description / levels[]，levels[i] 的字段由模板 level.levelFields 定义',
      },
    ],
    businessKey: ['system.name'],
  },
  world: {
    domain: 'world',
    label: '世界节点',
    description:
      '世界观树形节点，按名称唯一。用 parentId 挂到上级节点，形成宇宙→界域→地理→政区→组织的层级。',
    storage: { kind: 'perNovelTable', base: 'novel_world_nodes' },
    section: 'world',
    scalars: [
      { key: 'name', column: 'name', type: 'text', label: '节点名', required: true, inIndex: true },
      {
        key: 'kind',
        column: 'kind',
        type: 'enum',
        label: '节点类型',
        required: true,
        values: WORLD_KINDS,
        valueLabels: WORLD_NODE_KIND_LABELS,
        aliases: WORLD_KIND_ALIASES,
        default: 'custom',
        inIndex: true,
      },
      {
        key: 'parentId',
        column: 'parent_id',
        type: 'ref',
        label: '上级节点',
        nullable: true,
        ref: { domain: 'world', resolveBy: 'name' },
        inIndex: true,
      },
      { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
    ],
    json: [
      {
        key: 'detail',
        column: 'detail_json',
        label: '四栏详情',
        shape: 'worldDetail',
        merge: 'deepMerge',
        description: '固定四栏 geography / culture / history / factions',
      },
      {
        key: 'extra',
        column: 'extra_json',
        label: '扩展字段',
        templatePath: 'world.defaultDetailFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['name'],
    parentField: 'parentId',
    sortField: 'sortOrder',
    quality: { minJsonFilled: 2 },
  },
  worldTimeline: {
    domain: 'worldTimeline',
    label: '世界时间线',
    description: '某个世界节点的历史事件，按「节点 + 时间点」唯一。',
    storage: { kind: 'perNovelTable', base: 'novel_world_timeline' },
    section: 'world',
    scalars: timelineScalars({
      key: 'worldNodeId',
      column: 'world_node_id',
      label: '世界节点',
      domain: 'world',
    }),
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '时间线扩展字段',
        templatePath: 'world.timeline.extraFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['worldNodeId', 'timePoint'],
    sortField: 'sortOrder',
  },
  timeline: {
    domain: 'timeline',
    label: '全书时间线',
    description:
      '全书主线事件、冲突、悬念与伏笔，按「时间点 + 标题」唯一。悬念和伏笔用 isResolved 追踪是否已收束。',
    storage: { kind: 'perNovelTable', base: 'novel_timeline_events' },
    section: 'timeline',
    scalars: [
      {
        key: 'timeLabel',
        column: 'time_label',
        type: 'text',
        label: '时间标签',
        required: true,
        inIndex: true,
      },
      {
        key: 'timePoint',
        column: 'time_point',
        type: 'int',
        label: '时间点',
        required: true,
        inIndex: true,
        ddl: 'BIGINT',
        description: '排序用有符号整数，越大越靠后',
      },
      { key: 'title', column: 'title', type: 'text', label: '事件标题', required: true, inIndex: true },
      {
        key: 'content',
        column: 'content',
        type: 'longText',
        label: '事件内容',
        required: true,
        truncateAt: 4000,
      },
      {
        key: 'eventType',
        column: 'event_type',
        type: 'enum',
        label: '事件类型',
        values: [...TIMELINE_EVENT_TYPES],
        valueLabels: TIMELINE_EVENT_TYPE_LABELS,
        aliases: {
          turningPoint: 'turning',
          turning_point: 'turning',
          climax: 'turning',
        },
        default: 'other',
        inIndex: true,
      },
      {
        key: 'isResolved',
        column: 'is_resolved',
        type: 'bool',
        label: '是否已收束',
        default: false,
        inIndex: true,
        description: '悬念/伏笔/冲突是否已在正文中解决',
      },
      {
        key: 'relatedChapterNo',
        column: 'related_chapter_id',
        type: 'ref',
        label: '触发章节',
        nullable: true,
        ref: { domain: 'chapter', resolveBy: 'chapterNo' },
        inIndex: true,
        description: '传章号正整数，不要传 UUID',
      },
      {
        key: 'resolveChapterNo',
        column: 'resolve_chapter_id',
        type: 'ref',
        label: '收束章节',
        nullable: true,
        ref: { domain: 'chapter', resolveBy: 'chapterNo' },
        inIndex: true,
      },
      { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
    ],
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '扩展字段',
        templatePath: 'timeline.extraFields',
        merge: 'deepMerge',
      },
    ],
    businessKey: ['timePoint', 'title'],
    sortField: 'sortOrder',
    quality: { minTextChars: 20 },
  },
  outline: {
    domain: 'outline',
    label: '大纲',
    description:
      '两层大纲树：volume 是卷，chapter_segment 是单章说明。卷按卷号唯一，单章按「所属卷 + 章号」唯一。章节写作直接依赖它。',
    storage: { kind: 'perNovelTable', base: 'novel_outline_nodes' },
    section: 'outline',
    discriminator: 'kind',
    scalars: [
      {
        key: 'kind',
        column: 'kind',
        type: 'enum',
        label: '节点类型',
        required: true,
        values: ['volume', 'chapter_segment'],
        valueLabels: { volume: '卷', chapter_segment: '单章说明' },
        aliases: { chapter: 'chapter_segment', segment: 'chapter_segment', book: 'volume' },
        inIndex: true,
      },
      {
        key: 'name',
        column: 'name',
        type: 'text',
        label: '标题',
        required: true,
        inIndex: true,
        description: '卷名或单章标题，不要带「第N卷」「第N章」前缀，序号由 ordinal 表达',
      },
      {
        key: 'ordinal',
        column: 'chapter_range',
        type: 'text',
        label: '序号',
        required: true,
        inIndex: true,
        description: 'kind=volume 时为卷号，kind=chapter_segment 时为章号，均为正整数',
      },
      {
        key: 'parentId',
        column: 'parent_id',
        type: 'ref',
        label: '所属卷',
        nullable: true,
        ref: { domain: 'outline', resolveBy: 'name' },
        inIndex: true,
        description: 'chapter_segment 必须挂在某个 volume 下',
      },
      {
        key: 'content',
        column: 'content',
        type: 'longText',
        label: '内容要点',
        required: true,
        truncateAt: 4000,
      },
      { key: 'sortOrder', column: 'sort_order', type: 'int', label: '排序', readOnly: true },
    ],
    json: [
      {
        key: 'extra',
        column: 'extra_json',
        label: '扩展字段',
        templatePathByKind: {
          volume: 'outline.volumeFields',
          chapter_segment: 'outline.chapterSegmentFields',
        },
        merge: 'deepMerge',
        description: '含 theme / conflict / majorEvents 及模板扩展字段',
      },
    ],
    businessKey: ['kind', 'ordinal'],
    businessKeyByKind: {
      volume: ['kind', 'ordinal'],
      chapter_segment: ['parentId', 'ordinal'],
    },
    parentField: 'parentId',
    sortField: 'sortOrder',
    quality: { minTextChars: 30, stripOrdinalPrefixFrom: ['name'] },
  },
  chapter: {
    domain: 'chapter',
    label: '章节正文',
    description: '章节正文，按章号唯一寻址。章号即排序，从 1 开始连续。',
    storage: { kind: 'perNovelTable', base: 'novel_chapters' },
    section: 'chapters',
    scalars: [
      {
        key: 'chapterNo',
        column: 'sort_order',
        type: 'int',
        label: '章号',
        required: true,
        inIndex: true,
        description: '正整数，从 1 开始',
      },
      {
        key: 'title',
        column: 'title',
        type: 'text',
        label: '章节标题',
        required: true,
        inIndex: true,
        description: '不要带「第N章」前缀，序号由 chapterNo 表达',
      },
      { key: 'content', column: 'content', type: 'longText', label: '正文', truncateAt: 2000 },
    ],
    businessKey: ['chapterNo'],
    sortField: 'chapterNo',
    effects: ['refreshNovelStats'],
    quality: { minTextChars: 200, stripOrdinalPrefixFrom: ['title'], sequentialField: 'chapterNo' },
  },
  skill: {
    domain: 'skill',
    label: '技能',
    description: '指导 AI 创作与审查的规则文档。agentKind=write 注入写作 Agent，review 注入审查 Agent。',
    storage: { kind: 'globalTable', table: 'novel_skills' },
    scalars: [
      { key: 'title', column: 'title', type: 'text', label: '标题', required: true, inIndex: true },
      {
        key: 'section',
        column: 'section',
        type: 'enum',
        label: '所属区块',
        required: true,
        values: [...SKILL_SECTIONS],
        inIndex: true,
      },
      {
        key: 'agentKind',
        column: 'agent_kind',
        type: 'enum',
        label: '用途',
        required: true,
        values: ['write', 'review'],
        valueLabels: { write: '写作', review: '审查' },
        default: 'write',
        inIndex: true,
      },
      {
        key: 'skillType',
        column: 'skill_type',
        type: 'enum',
        label: '节点类型',
        values: ['directory', 'skill'],
        default: 'skill',
      },
      { key: 'category', column: 'category', type: 'text', label: '题材标签', nullable: true },
      {
        key: 'parentId',
        column: 'parent_id',
        type: 'ref',
        label: '上级目录',
        nullable: true,
        ref: { domain: 'skill', resolveBy: 'name' },
      },
      { key: 'content', column: 'content', type: 'longText', label: '正文', truncateAt: 8000 },
    ],
    businessKey: ['section', 'agentKind', 'title'],
    parentField: 'parentId',
  },
}

export const ENTITY_DOMAIN_LIST = Object.values(ENTITY_REGISTRY)

export function getDomainDef(domain: EntityDomain): EntityDef {
  const def = ENTITY_REGISTRY[domain]
  if (!def) throw new Error(`未知实体域：${domain}`)
  return def
}

export function tableNameOf(def: EntityDef, _novelId?: string): string {
  switch (def.storage.kind) {
    case 'perNovelTable':
      return def.storage.base
    case 'globalTable':
      return def.storage.table
    case 'novelColumn':
      return def.storage.table
  }
}

export function scalarOf(def: EntityDef, key: string): ScalarField | undefined {
  return def.scalars.find((f) => f.key === key)
}

export function jsonFieldOf(def: EntityDef, key: string): JsonField | undefined {
  return def.json?.find((f) => f.key === key)
}

export function businessKeyOf(def: EntityDef, row: Record<string, unknown>): string[] {
  if (def.discriminator && def.businessKeyByKind) {
    const kind = String(row[def.discriminator] ?? '')
    const keys = def.businessKeyByKind[kind]
    if (keys) return [...keys]
  }
  return [...def.businessKey]
}

export function needsNovelIdColumn(def: EntityDef): boolean {
  return def.storage.kind !== 'novelColumn'
}

export function perNovelDomains(): EntityDef[] {
  return ENTITY_DOMAIN_LIST.filter((d) => d.storage.kind === 'perNovelTable')
}

export function ddlTypeOf(field: ScalarField): string {
  if (field.ddl) return field.ddl
  switch (field.type) {
    case 'int':
      return 'INTEGER'
    case 'bool':
      return 'BOOLEAN'
    case 'ref':
      return 'TEXT'
    default:
      return 'TEXT'
  }
}

export function keyExpr(def: EntityDef, key: string): string {
  if (!key.includes('.')) return scalarOf(def, key)?.column ?? ''
  const [containerKey, ...rest] = key.split('.')
  const container = def.json?.find((j) => j.key === containerKey)
  if (!container || rest.length !== 1) return ''
  return `((${container.column}->>'${rest[0]}'))`
}

export function emptyFormTemplateConfig(): FormTemplateConfig {
  return {
    version: 1,
    overview: { fields: [] },
    role: { detailFields: [], relation: { extraFields: [] }, timeline: { extraFields: [] } },
    level: { levelFields: [] },
    world: { defaultDetailFields: [], timeline: { extraFields: [] } },
    timeline: { extraFields: [] },
    outline: { volumeFields: [], chapterSegmentFields: [] },
    item: { detailFields: [], timeline: { extraFields: [] } },
    creature: { detailFields: [], timeline: { extraFields: [] } },
  } as FormTemplateConfig & { version: number }
}

export function coerceFormTemplateConfig(raw: unknown): FormTemplateConfig {
  if (raw == null || (typeof raw === 'string' && raw.trim() === '')) {
    return emptyFormTemplateConfig()
  }
  let o: Record<string, unknown> =
    typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw as Record<string, unknown>)
  if (o == null || typeof o !== 'object' || Array.isArray(o)) {
    return emptyFormTemplateConfig()
  }
  const rec = { ...o }
  if (rec.level == null && rec.profession != null) {
    rec.level = rec.profession
  }
  delete rec.profession
  if (rec.creature == null) {
    rec.creature = { detailFields: [], timeline: { extraFields: [] } }
  }
  return rec as unknown as FormTemplateConfig
}

function readPath(config: FormTemplateConfig, path: string): FormTemplateField[] {
  let cur: unknown = config
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return []
    cur = (cur as Record<string, unknown>)[seg]
  }
  return Array.isArray(cur) ? (cur as FormTemplateField[]) : []
}

export function templateFieldsFor(
  config: FormTemplateConfig,
  json: JsonField,
  kind?: string,
): FormTemplateField[] {
  if (json.templatePathByKind && kind) {
    const path = json.templatePathByKind[kind]
    return path ? readPath(config, path) : []
  }
  if (json.templatePathByKind && !kind) {
    return Object.values(json.templatePathByKind).flatMap((p) => readPath(config, p))
  }
  return json.templatePath ? readPath(config, json.templatePath) : []
}

export function optionValuesOf(field: FormTemplateField): string[] {
  const raw = field.options
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    if ('options' in item && Array.isArray((item as { options: unknown[] }).options)) {
      for (const sub of (item as { options: unknown[] }).options) {
        if (sub && typeof sub === 'object' && 'value' in sub) {
          out.push(String((sub as { value: unknown }).value))
        }
      }
      continue
    }
    if ('value' in item) out.push(String((item as { value: unknown }).value))
  }
  return out
}

export async function describeOneDomain(
  novelId: string | undefined,
  domain: EntityDomain,
  loadConfig: (novelId: string) => Promise<FormTemplateConfig>,
): Promise<DomainDescription> {
  const def = getDomainDef(domain)
  const config = novelId ? await loadConfig(novelId) : emptyFormTemplateConfig()
  const fields: DomainFieldDesc[] = []

  for (const f of def.scalars) {
    if (f.readOnly) continue
    fields.push({
      key: f.key,
      label: f.label,
      type: f.type,
      ...(f.required ? { required: true } : {}),
      ...(f.values ? { allowed: [...f.values] } : {}),
      ...(f.ref
        ? { ref: `${f.ref.domain}（可传${f.ref.resolveBy === 'name' ? '名称' : '章号'}）` }
        : {}),
      ...(f.description ? { note: f.description } : {}),
    })
  }

  for (const j of def.json ?? []) {
    if (j.shape === 'worldDetail') {
      for (const key of WORLD_DETAIL_KEYS) {
        fields.push({ key: `${j.key}.${key}`, label: key, type: 'longText' })
      }
    }
    if (j.shape === 'levelSystem') {
      fields.push(
        { key: `${j.key}.name`, label: '体系名', type: 'text', required: true },
        { key: `${j.key}.category`, label: '体系分类', type: 'text' },
        { key: `${j.key}.description`, label: '体系说明', type: 'longText' },
        {
          key: `${j.key}.levels`,
          label: '阶梯数组',
          type: 'array',
          note: '每项含 name / subLevels[] / promotionCondition / abilities，按 name 合并',
        },
      )
    }
    const kinds = j.templatePathByKind ? Object.keys(j.templatePathByKind) : [undefined]
    for (const kind of kinds) {
      for (const tf of templateFieldsFor(config, j, kind)) {
        const allowed = optionValuesOf(tf)
        fields.push({
          key: `${j.key}.${tf.key}`,
          label: tf.label || tf.key,
          type: tf.component ?? 'text',
          ...(tf.required ? { required: true } : {}),
          ...(allowed.length > 0 ? { allowed } : {}),
          ...(tf.multiple ? { multiple: true } : {}),
          ...(kind ? { note: `仅 ${def.discriminator}=${kind} 时有效` } : {}),
        })
      }
    }
  }

  return {
    domain,
    label: def.label,
    description: def.description,
    businessKey: def.businessKey,
    ...(def.businessKeyByKind
      ? {
          businessKeyByKind: Object.fromEntries(
            Object.entries(def.businessKeyByKind).map(([k, v]) => [k, [...v]]),
          ),
        }
      : {}),
    fields,
  }
}

export function domainCatalog(): string {
  return Object.values(ENTITY_REGISTRY)
    .map((d) => `${d.domain}(${d.label})`)
    .join('、')
}

export function canBeWorldRoot(kind: string): boolean {
  return kind === 'universe' || kind === 'multiverse' || kind === 'custom'
}

const SETTLEMENT_RANK: Record<string, number> = {
  empire: 0,
  kingdom: 0,
  federation: 0,
  country: 1,
  region: 2,
  city: 3,
  town: 4,
  settlement: 4,
}

function worldKindLayer(kind: string): number {
  switch (kind) {
    case 'universe':
    case 'multiverse':
      return 0
    case 'galaxy':
    case 'star_cluster':
    case 'star_system':
    case 'nebula':
    case 'realm':
    case 'domain':
    case 'plane':
    case 'dimension':
      return 1
    case 'planet':
    case 'satellite':
    case 'space_station':
    case 'mainland':
    case 'continent':
    case 'ocean':
    case 'region':
    case 'mountain':
    case 'secret_realm':
      return 2
    case 'country':
    case 'empire':
    case 'kingdom':
    case 'federation':
    case 'city':
    case 'town':
    case 'settlement':
      return 3
    case 'royal':
    case 'sect':
    case 'clan':
    case 'guild':
    case 'army':
    case 'fleet':
    case 'corporation':
    case 'faction':
    case 'hall':
    case 'alliance':
    case 'cult':
    case 'academy':
      return 4
    case 'custom':
      return -1
    default:
      return -1
  }
}

const MAX_LAYER_GAP = 2

export function isAllowedWorldParentChild(parentKind: string | null, childKind: string): boolean {
  if (childKind === 'custom') return true
  if (parentKind == null) return canBeWorldRoot(childKind)
  if (parentKind === 'custom') return true
  const pl = worldKindLayer(parentKind)
  const cl = worldKindLayer(childKind)
  if (pl < 0 || cl < 0) return true
  if (cl < pl) return false
  if (cl === pl) {
    if (pl !== 3) return false
    const pr = SETTLEMENT_RANK[parentKind]
    const cr = SETTLEMENT_RANK[childKind]
    return pr != null && cr != null && cr > pr
  }
  if (cl - pl > MAX_LAYER_GAP) return false
  return true
}

export function allowedParentKinds(childKind: string): string[] {
  return WORLD_KINDS.filter((p) => isAllowedWorldParentChild(p, childKind))
}

export function emptyWorldNodeDetail(): Record<string, string> {
  return { geography: '', culture: '', history: '', factions: '' }
}

export function emptyLevelSystem(): Record<string, unknown> {
  return {
    name: '自定义体系',
    category: '自定义',
    description: '',
    levels: [
      {
        name: '第一阶',
        subLevels: [{ name: '初期' }, { name: '中期' }, { name: '后期' }],
        promotionCondition: '达到上一阶大圆满，并满足作品内设定的突破条件。',
        abilities: '待补充该等级典型能力与表现。',
      },
    ],
  }
}
