import { z } from 'zod'

export const novelIdSchema = z.string().regex(/^[a-z0-9]{8}$/)

export const novelDtoSchema = z.object({
  id: novelIdSchema,
  title: z.string(),
  description: z.string(),
  cover: z.string(),
  category: z.string(),
  writingStyleId: z.string().nullable(),
  dbPath: z.string(),
  workspacePath: z.string(),
  chapterCount: z.number(),
  wordCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const novelListArgs = z.object({})
export const novelListReturn = z.array(novelDtoSchema)

export const novelGetArgs = z.object({ id: novelIdSchema })
export const novelGetReturn = novelDtoSchema.nullable()

export const novelCreateArgs = z.object({
  title: z.string().min(1),
  workspacePath: z.string().min(1),
})
export const novelCreateReturn = novelDtoSchema

export const novelUpdateArgs = z.object({
  id: novelIdSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  cover: z.string().optional(),
  category: z.string().optional(),
  writingStyleId: z.string().nullable().optional(),
})
export const novelUpdateReturn = novelDtoSchema

export const novelDeleteArgs = z.object({ id: novelIdSchema })
export const novelDeleteReturn = z.object({ ok: z.literal(true) })

export const dialogPickDirectoryArgs = z.object({})
export const dialogPickDirectoryReturn = z.object({
  path: z.string().nullable(),
})

export const novelSessionDtoSchema = z.object({
  id: z.string(),
  novelId: novelIdSchema,
  dshSessionId: z.string().nullable(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const novelSessionListArgs = z.object({ novelId: novelIdSchema })
export const novelSessionListReturn = z.array(novelSessionDtoSchema)

export const novelSessionCreateArgs = z.object({
  novelId: novelIdSchema,
  title: z.string().optional(),
})
export const novelSessionCreateReturn = novelSessionDtoSchema

export const novelSessionRenameArgs = z.object({
  id: z.string(),
  title: z.string().min(1),
})
export const novelSessionRenameReturn = novelSessionDtoSchema

export const novelSessionDeleteArgs = z.object({ id: z.string() })
export const novelSessionDeleteReturn = z.object({ ok: z.literal(true) })

export const novelContextSetArgs = z.object({
  novelId: novelIdSchema.nullable(),
  page: z
    .enum([
      'basic',
      'overview',
      'world',
      'role',
      'creature',
      'item',
      'level',
      'timeline',
      'outline',
      'chapters',
      'template',
      'skills',
    ])
    .nullable(),
})
export const novelContextSetReturn = novelContextSetArgs

export const entityDomainSchema = z.enum([
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
])

export const entityDepthSchema = z.union([
  z.enum(['index', 'full', 'raw']),
  z.number(),
])

export const entityQueryArgs = z.object({
  novelId: novelIdSchema,
  domain: entityDomainSchema,
  filter: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  depth: entityDepthSchema.optional(),
})

export const entityGetArgs = z.object({
  novelId: novelIdSchema,
  domain: entityDomainSchema,
  ids: z.array(z.string()).optional(),
  names: z.array(z.string()).optional(),
  depth: entityDepthSchema.optional(),
})

export const entityMutateArgs = z.object({
  novelId: novelIdSchema,
  ops: z.array(
    z.object({
      domain: entityDomainSchema,
      action: z.enum(['create', 'update', 'upsert', 'delete']),
      id: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    }),
  ),
})

export const entityDescribeArgs = z.object({
  novelId: novelIdSchema.optional(),
  domain: entityDomainSchema.optional(),
})

export const dshBootArgs = z.object({})
export const dshBootReturn = z.object({
  url: z.string(),
  token: z.string().optional(),
  ready: z.boolean().optional(),
})

export const dshSessionCreateReturn = z.object({ dshSessionId: z.string() })

export const novelSessionBindDshArgs = z.object({
  id: z.string(),
  dshSessionId: z.string(),
})
export const novelSessionBindDshReturn = z.object({ ok: z.literal(true) })

export const dshSessionCreateAndBindArgs = z.object({ novelSessionId: z.string() })
export const dshSessionCreateAndBindReturn = z.object({ dshSessionId: z.string() })

export const dshSettingsDescribeReturn = z.object({
  writable: z.boolean(),
  hasDocument: z.boolean(),
  namespaces: z.array(z.record(z.string(), z.unknown())),
})

export const dshSettingsMutateArgs = z.object({
  ns: z.string(),
  ops: z.array(
    z.union([
      z.object({ op: z.literal('set'), path: z.array(z.string()), value: z.unknown() }),
      z.object({ op: z.literal('delete'), path: z.array(z.string()) }),
      z.object({ op: z.literal('unset'), path: z.array(z.string()) }),
    ]),
  ),
  expectedRevision: z.number().optional(),
})
export const dshSettingsMutateReturn = z.record(z.string(), z.unknown())

export const dshSettingsOpenDocumentReturn = z.object({ opened: z.literal(true) })

export const dshSettingsOpenAgentPresetDirectoryArgs = z.object({ presetId: z.string() })
export const dshSettingsOpenAgentPresetDirectoryReturn = z.object({ opened: z.literal(true) })

export const dshLlmListProvidersReturn = z.array(
  z.object({ id: z.string(), name: z.string() }),
)

export const dshLlmListConfigurableProvidersReturn = z.array(
  z.object({
    provider: z.string(),
    displayName: z.string(),
    settingsNs: z.string(),
    settingsPath: z.array(z.string()),
    declared: z.boolean().optional(),
  }),
)

export const agentPresetRosterEntrySchema = z.object({
  id: z.string(),
  trust: z.enum(['system', 'user']),
  isDefault: z.boolean(),
  name: z.string().optional(),
  description: z.string().optional(),
  broken: z.string().optional(),
})

export const dshAgentPresetsListReturn = z.object({
  presets: z.array(agentPresetRosterEntrySchema),
  authorable: z.boolean(),
})

export const dshAgentPresetsCopyArgs = z.object({
  from: z.string(),
  id: z.string(),
  name: z.string().optional(),
})
export const dshAgentPresetsCopyReturn = z.object({ ok: z.literal(true) })

export const dshAgentPresetsDeleteArgs = z.object({ id: z.string() })
export const dshAgentPresetsDeleteReturn = z.object({ ok: z.literal(true) })

export const dshAgentPresetsReadArgs = z.object({ id: z.string() })
export const dshAgentPresetsReadReturn = z.object({ content: z.string() })

export const dshSessionGetAgentPresetArgs = z.object({
  dshSessionId: z.string(),
})
export const dshSessionGetAgentPresetReturn = z.object({
  presetId: z.string().nullable(),
  locked: z.boolean(),
})

export const dshSessionSelectAgentPresetArgs = z.object({
  dshSessionId: z.string(),
  presetId: z.string(),
})
export const dshSessionSelectAgentPresetReturn = z.object({
  presetId: z.string(),
})

export const dshPluginInventoryListReturn = z.object({
  entries: z.array(
    z.object({
      entryId: z.string(),
      moduleName: z.string(),
      enabled: z.boolean(),
      fiberPhase: z.string().nullable(),
    }),
  ),
})
