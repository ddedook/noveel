export type EntityDomain =
  | 'overview'
  | 'role'
  | 'roleRelation'
  | 'roleTimeline'
  | 'creature'
  | 'creatureTimeline'
  | 'item'
  | 'itemTimeline'
  | 'level'
  | 'world'
  | 'worldTimeline'
  | 'timeline'
  | 'outline'
  | 'chapter'
  | 'skill'

export type ScalarType = 'text' | 'longText' | 'int' | 'bool' | 'enum' | 'ref'

export type RefSpec = {
  domain: EntityDomain
  resolveBy: 'name' | 'chapterNo'
}

export type ScalarField = {
  key: string
  column: string
  type: ScalarType
  label: string
  required?: boolean
  nullable?: boolean
  readOnly?: boolean
  inIndex?: boolean
  ddl?: string
  default?: string | number | boolean
  values?: readonly string[]
  valueLabels?: Record<string, string>
  aliases?: Record<string, string>
  ref?: RefSpec
  truncateAt?: number
  description?: string
}

export type JsonMerge = 'deepMerge' | 'replace' | 'levelTiers'

export type JsonField = {
  key: string
  column: string
  label: string
  merge?: JsonMerge
  templatePath?: string
  templatePathByKind?: Record<string, string>
  shape?: 'worldDetail' | 'levelSystem'
  description?: string
}

export type StorageSpec =
  | { kind: 'perNovelTable'; base: string }
  | { kind: 'globalTable'; table: string }
  | { kind: 'novelColumn'; table: string; column: string }

export type EntityDef = {
  domain: EntityDomain
  label: string
  description: string
  storage: StorageSpec
  section?: string
  singleton?: boolean
  discriminator?: string
  scalars: ScalarField[]
  json?: JsonField[]
  businessKey: string[]
  businessKeyByKind?: Record<string, string[]>
  sortField?: string
  parentField?: string
  indexHintKeys?: string[]
  effects?: ('bidirectionalRelation' | 'refreshNovelStats')[]
  quality?: Record<string, unknown>
}

export type EntityDepth = 'index' | 'full' | 'raw'

export type EntityFilter = {
  search?: string
  where?: Record<string, unknown>
}

export type QueryEntitiesInput = {
  domain: EntityDomain
  filter?: EntityFilter
  limit?: number
  offset?: number
  depth?: EntityDepth | number
}

export type GetEntitiesInput = {
  domain: EntityDomain
  ids?: string[]
  names?: (string | number)[]
  depth?: EntityDepth | number
}

export type MutateOp = {
  domain: EntityDomain
  action: 'create' | 'update' | 'upsert' | 'delete'
  match?: Record<string, unknown>
  data?: Record<string, unknown>
  all?: boolean
  id?: string
}

export type NormalizedInput = {
  scalars: Record<string, unknown>
  json: Record<string, unknown>
  notes: string[]
}

export type EntityIssueCode =
  | 'UNKNOWN_FIELD'
  | 'MISSING_REQUIRED_FIELD'
  | 'INVALID_ENUM_VALUE'
  | 'INVALID_TYPE'
  | 'REF_NOT_FOUND'
  | 'REF_AMBIGUOUS'
  | 'ENTITY_NOT_FOUND'
  | 'INVALID_STRUCTURE'
  | 'UNSUPPORTED_ACTION'
  | 'DUPLICATE_BUSINESS_KEY'
  | 'DUPLICATE_ORDINAL'
  | 'CONSTRAINT_VIOLATION'
  | 'INTERNAL_ERROR'

export type EntityIssue = {
  code: EntityIssueCode
  message: string
  domain?: EntityDomain
  field?: string
  received?: unknown
  allowed?: unknown[]
  candidates?: Array<{ id: string; name: string }>
  suggestion?: unknown
  fix?: unknown
  index?: number
}

export type MutateResultItem =
  | {
      index: number
      ok: true
      domain: EntityDomain
      action: string
      id?: string
      key?: unknown
      before?: unknown
      notes?: string[]
    }
  | {
      index: number
      ok: false
      code?: EntityIssueCode
      message: string
      domain?: EntityDomain
      field?: string
      received?: unknown
      allowed?: unknown[]
      candidates?: Array<{ id: string; name: string }>
      suggestion?: unknown
      fix?: unknown
    }

export type MutateReport = {
  ok: boolean
  applied: number
  failed: number
  results: MutateResultItem[]
  retryGuidance?: string
}

export type DomainFieldDesc = {
  key: string
  label: string
  type: string
  required?: boolean
  allowed?: string[]
  ref?: string
  note?: string
  multiple?: boolean
}

export type DomainDescription = {
  domain: EntityDomain
  label: string
  description: string
  businessKey: string[]
  businessKeyByKind?: Record<string, string[]>
  fields: DomainFieldDesc[]
}

export type FormTemplateField = {
  key: string
  label?: string
  component?: string
  required?: boolean
  multiple?: boolean
  allowCreate?: boolean
  options?: unknown[]
}

export type FormTemplateConfig = {
  overview: { fields: FormTemplateField[] }
  role: {
    detailFields: FormTemplateField[]
    relation?: { extraFields: FormTemplateField[] }
    timeline?: { extraFields: FormTemplateField[] }
  }
  level: { levelFields: FormTemplateField[] }
  world: { defaultDetailFields: FormTemplateField[]; timeline?: { extraFields: FormTemplateField[] } }
  timeline: { extraFields: FormTemplateField[] }
  outline: { volumeFields: FormTemplateField[]; chapterSegmentFields: FormTemplateField[] }
  item: { detailFields: FormTemplateField[]; timeline?: { extraFields: FormTemplateField[] } }
  creature: { detailFields: FormTemplateField[]; timeline?: { extraFields: FormTemplateField[] } }
}
