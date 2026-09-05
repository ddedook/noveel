// @ts-nocheck
import { randomUUID } from 'node:crypto'
import type { PGlite } from '@electric-sql/pglite'
import { getNovelDb } from '@/lib/main/db/novel-db-pool'
import { getRegistryDb } from '@/lib/main/db/registry-access'
import { assertNovelId } from '@/lib/main/novel/novel-context'
import {
  createNovelEntityTables,
  createNovelEntityUniqueIndexes,
  createNovelSupportTables,
  ensureNovelBlueprintRow,
} from './entity-ddl'
import {
  ENTITY_DOMAINS,
  WORLD_DETAIL_KEYS,
  WORLD_NODE_KIND_LABELS,
  allowedParentKinds,
  businessKeyOf,
  canBeWorldRoot,
  coerceFormTemplateConfig,
  describeOneDomain,
  emptyLevelSystem,
  emptyWorldNodeDetail,
  getDomainDef,
  isAllowedWorldParentChild,
  jsonFieldOf,
  needsNovelIdColumn,
  optionValuesOf,
  scalarOf,
  tableNameOf,
  templateFieldsFor,
} from './entity-schema'
import type {
  EntityDef,
  EntityDepth,
  EntityDomain,
  EntityIssue,
  FormTemplateConfig,
  GetEntitiesInput,
  JsonField,
  MutateOp,
  MutateReport,
  NormalizedInput,
  QueryEntitiesInput,
  RefSpec,
  ScalarField,
} from './entity-types'

const ensured = new Set<string>()
const templateCache = new Map<string, { at: number; config: FormTemplateConfig }>()
const TEMPLATE_TTL_MS = 15_000
const DEFAULT_LIMIT = 30
const MAX_LIMIT = 200
const MAX_GET_IDS = 20
const MAX_ALLOWED_INLINE = 40
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RETRY_GUIDANCE =
  '部分操作失败。每条失败结果都带 received / allowed / suggestion / fix，请按 fix 重发失败项即可，不要重发已成功的操作。'

type DbRow = Record<string, unknown>

function rowOf(raw: unknown): DbRow {
  return raw as DbRow
}

class EntityError extends Error {
  issue: EntityIssue
  constructor(issue: EntityIssue) {
    super(issue.message)
    this.name = 'EntityError'
    this.issue = issue
  }
}

function entityError(issue: EntityIssue): EntityError {
  return new EntityError(issue)
}

function toEntityIssue(err: unknown, domain?: EntityDomain, index?: number): EntityIssue {
  if (err instanceof EntityError) {
    return { ...err.issue, ...(index !== undefined ? { index } : {}) }
  }
  const message = err instanceof Error ? err.message : String(err)
  return {
    code: 'INTERNAL_ERROR',
    message: message.slice(0, 600),
    ...(domain ? { domain } : {}),
    ...(index !== undefined ? { index } : {}),
  }
}

function unknownField(domain: EntityDomain | string, field: string, allowed: string[]): EntityError {
  const suggestion = closestMatch(field, allowed)
  return entityError({
    code: 'UNKNOWN_FIELD',
    domain: domain as EntityDomain,
    field,
    message: `${domain} 不存在字段「${field}」`,
    received: field,
    allowed: allowed.slice(0, MAX_ALLOWED_INLINE),
    ...(suggestion ? { suggestion } : {}),
  })
}

function missingRequired(domain: EntityDomain, field: string, label: string): EntityError {
  return entityError({
    code: 'MISSING_REQUIRED_FIELD',
    domain,
    field,
    message: `${domain}.${field}（${label}）是必填字段`,
  })
}

function invalidEnum(
  domain: EntityDomain,
  field: string,
  received: unknown,
  allowed: string[],
  labels?: Record<string, string>,
): EntityError {
  const allowedDisplay = labels ? allowed.map((v) => (labels[v] ? `${v}(${labels[v]})` : v)) : allowed
  return entityError({
    code: 'INVALID_ENUM_VALUE',
    domain,
    field,
    message: `${domain}.${field} 收到不合法的值「${String(received)}」`,
    received,
    allowed: allowedDisplay.slice(0, MAX_ALLOWED_INLINE),
    suggestion: closestMatch(String(received ?? ''), allowed),
  })
}

function invalidType(domain: EntityDomain, field: string, received: unknown, expected: string): EntityError {
  return entityError({
    code: 'INVALID_TYPE',
    domain,
    field,
    message: `${domain}.${field} 期望 ${expected}，收到 ${typeof received}`,
    received,
  })
}

function refNotFound(
  domain: EntityDomain,
  field: string,
  received: unknown,
  targetLabel: string,
  candidates: Array<{ id: string; name: string }>,
): EntityError {
  return entityError({
    code: 'REF_NOT_FOUND',
    domain,
    field,
    message: `${domain}.${field} 指向的${targetLabel}「${String(received)}」不存在，请先创建它或改用已有名称`,
    received,
    candidates: candidates.slice(0, 20),
    suggestion: closestMatch(String(received ?? ''), candidates.map((c) => c.name)),
  })
}

function refAmbiguous(
  domain: EntityDomain,
  field: string,
  received: unknown,
  candidates: Array<{ id: string; name: string }>,
): EntityError {
  return entityError({
    code: 'REF_AMBIGUOUS',
    domain,
    field,
    message: `${domain}.${field} 的「${String(received)}」匹配到多个对象，请改传 id`,
    received,
    candidates: candidates.slice(0, 20),
    suggestion: candidates[0]?.id,
  })
}

function entityNotFound(domain: EntityDomain, match: unknown): EntityError {
  return entityError({
    code: 'ENTITY_NOT_FOUND',
    domain,
    message: `按 ${JSON.stringify(match)} 未找到${domain}。若要新建请改用 action: "create" 或 "upsert"`,
    received: match,
  })
}

function closestMatch(input: string, candidates: string[]): string | undefined {
  const s = input.trim().toLowerCase()
  if (!s || candidates.length === 0) return undefined
  let best: { value: string; score: number } | undefined
  for (const c of candidates) {
    const t = c.toLowerCase()
    if (t === s) return c
    const score = 1 - levenshtein(s, t) / Math.max(s.length, t.length)
    if (!best || score > best.score) best = { value: c, score }
  }
  return best && best.score >= 0.6 ? best.value : undefined
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = curr
  }
  return prev[b.length]!
}

async function ensureNovelTables(novelId: string): Promise<PGlite> {
  assertNovelId(novelId)
  const db = await getNovelDb(novelId)
  if (!ensured.has(novelId)) {
    await createNovelSupportTables(db)
    await createNovelEntityTables(db, novelId)
    await createNovelEntityUniqueIndexes(db, novelId)
    await ensureNovelBlueprintRow(db, novelId)
    ensured.add(novelId)
  }
  return db
}

async function loadTemplateConfig(novelId: string): Promise<FormTemplateConfig> {
  const cached = templateCache.get(novelId)
  if (cached && Date.now() - cached.at < TEMPLATE_TTL_MS) return cached.config
  const db = await ensureNovelTables(novelId)
  const { rows } = await db.query(`SELECT config FROM form_templates ORDER BY updated_at DESC LIMIT 1`)
  const config = coerceFormTemplateConfig(rowOf(rows[0]).config ?? null)
  templateCache.set(novelId, { at: Date.now(), config })
  return config
}

function parseJsonColumn(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw))
    return v != null && typeof v === 'object' && !Array.isArray(v) ? v : {}
  } catch {
    return {}
  }
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    const prev = out[key]
    if (
      value != null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prev != null &&
      typeof prev === 'object' &&
      !Array.isArray(prev)
    ) {
      out[key] = deepMerge(prev as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      out[key] = value
    }
  }
  return out
}

function coerceDepth(depth?: EntityDepth | number): EntityDepth {
  if (depth === 'full' || depth === 'raw' || depth === 'index') return depth
  return 'index'
}

function normalizeMutateOp(op: MutateOp): MutateOp {
  const match = op.match ?? (op.id ? { id: op.id } : undefined)
  return { ...op, match }
}

export async function describeDomain(
  domain?: EntityDomain,
  novelId?: string,
): Promise<Record<string, unknown>[]> {
  const loadConfig = (id: string) => loadTemplateConfig(id)
  if (domain) {
    const desc = await describeOneDomain(novelId, domain, loadConfig)
    return [desc as unknown as Record<string, unknown>]
  }
  const descs = await Promise.all(
    ENTITY_DOMAINS.map((d) => describeOneDomain(novelId, d, loadConfig)),
  )
  return descs as unknown as Record<string, unknown>[]
}

export async function queryEntities(
  novelId: string,
  input: QueryEntitiesInput,
): Promise<Record<string, unknown>[]> {
  const def = getDomainDef(input.domain)
  const db = await ensureNovelTables(novelId)
  if (def.storage.kind === 'novelColumn') {
    const item = await readNovelColumn(db, novelId, def)
    return [item]
  }
  const table = tableNameOf(def, novelId)
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT))
  const offset = Math.max(0, input.offset ?? 0)
  const { clause, params } = buildWhere(def, novelId, input.filter)
  const { rows } = await db.query(
    `SELECT * FROM ${table} ${clause} ${orderClause(def)} LIMIT ${limit} OFFSET ${offset}`,
    params,
  )
  const resolver = createRefResolver(novelId, db)
  const depth = coerceDepth(input.depth)
  return Promise.all(rows.map((r) => rowToEntity(def, r as Record<string, unknown>, depth, resolver)))
}

export async function getEntities(
  novelId: string,
  input: GetEntitiesInput,
): Promise<Record<string, unknown>[]> {
  const def = getDomainDef(input.domain)
  const db = await ensureNovelTables(novelId)
  if (def.storage.kind === 'novelColumn') {
    return [await readNovelColumn(db, novelId, def)]
  }
  const table = tableNameOf(def, novelId)
  const resolver = createRefResolver(novelId, db)
  const depth = coerceDepth(input.depth ?? 'full')
  const ids = new Set((input.ids ?? []).map((s) => String(s).trim()).filter(Boolean))
  for (const natural of (input.names ?? []).slice(0, MAX_GET_IDS)) {
    const id = await resolveNaturalKey(novelId, def, natural, resolver, db)
    if (id) ids.add(id)
  }
  if (ids.size === 0) return []
  const list = [...ids].slice(0, MAX_GET_IDS)
  const { rows } = await db.query(
    `SELECT * FROM ${table} WHERE id = ANY($1::text[]) ${orderClause(def)}`,
    [list],
  )
  return Promise.all(rows.map((r) => rowToEntity(def, r as Record<string, unknown>, depth, resolver)))
}

export async function mutateEntities(novelId: string, ops: MutateOp[]): Promise<MutateReport> {
  const db = await ensureNovelTables(novelId)
  const resolver = createRefResolver(novelId, db)
  const results: MutateReport['results'] = []
  const touched = new Set<EntityDomain>()
  for (let index = 0; index < ops.length; index++) {
    const op = normalizeMutateOp(ops[index]!)
    try {
      const outcome = await applyOne(db, novelId, op, resolver)
      results.push({ index, ok: true, ...outcome })
      touched.add(op.domain)
      resolver.invalidate(op.domain)
    } catch (err) {
      results.push({ index, ok: false, ...toEntityIssue(err, op.domain, index) })
    }
  }
  for (const domain of touched) {
    const def = getDomainDef(domain)
    if (def.effects?.includes('refreshNovelStats')) {
      await refreshNovelStats(novelId, db).catch(() => undefined)
    }
  }
  const failed = results.filter((r) => !r.ok).length
  return {
    ok: failed === 0,
    applied: results.length - failed,
    failed,
    results,
    ...(failed > 0 ? { retryGuidance: RETRY_GUIDANCE } : {}),
  }
}

async function readNovelColumn(
  db: PGlite,
  novelId: string,
  def: EntityDef,
): Promise<Record<string, unknown>> {
  const storage = def.storage
  if (storage.kind !== 'novelColumn') throw new Error('not novelColumn')
  const { rows } = await db.query(
    `SELECT ${storage.column} AS payload FROM ${storage.table} WHERE novel_id = $1`,
    [novelId],
  )
  if (!rows[0]) throw entityNotFound(def.domain, { novelId })
  const row = rowOf(rows[0])
  const registry = getRegistryDb()
  const { rows: meta } = await registry.query(`SELECT title, category FROM novels WHERE id = $1`, [novelId])
  const metaRow = rowOf(meta[0])
  const container = def.json?.[0]
  return {
    novelTitle: String(metaRow.title ?? ''),
    category: String(metaRow.category ?? '玄幻'),
    ...(container ? { [container.key]: parseJsonColumn(row.payload) } : {}),
  }
}

async function refreshNovelStats(novelId: string, db: PGlite): Promise<void> {
  const table = tableNameOf(getDomainDef('chapter'), novelId)
  let chapterCount = 0
  let wordCount = 0
  try {
    const { rows } = await db.query(`SELECT content FROM ${table} WHERE novel_id = $1`, [novelId])
    chapterCount = rows.length
    for (const r of rows) {
      wordCount += String(rowOf(r).content ?? '').replace(/\s/g, '').length
    }
  } catch {
    chapterCount = 0
    wordCount = 0
  }
  const registry = getRegistryDb()
  await registry.query(
    `UPDATE novels SET chapter_count = $2, word_count = $3, updated_at = NOW() WHERE id = $1`,
    [novelId, chapterCount, wordCount],
  )
}

function buildWhere(def: EntityDef, novelId: string, filter?: QueryEntitiesInput['filter']) {
  const conditions: string[] = []
  const params: unknown[] = []
  if (needsNovelIdColumn(def)) {
    params.push(novelId)
    conditions.push(`novel_id = $${params.length}`)
  }
  if (filter?.search?.trim()) {
    const searchable = def.scalars.filter((f) => f.type === 'text' || f.type === 'longText')
    if (searchable.length > 0) {
      params.push(`%${filter.search.trim()}%`)
      const p = `$${params.length}`
      conditions.push(`(${searchable.map((f) => `${f.column} ILIKE ${p}`).join(' OR ')})`)
    }
  }
  for (const [key, cond] of Object.entries(filter?.where ?? {})) {
    const field = scalarOf(def, key)
    if (!field) throw unknownField(def.domain, key, def.scalars.map((f) => f.key))
    const col = field.column
    if (cond === null) {
      conditions.push(`${col} IS NULL`)
      continue
    }
    if (typeof cond === 'object' && cond !== null) {
      const obj = cond as Record<string, unknown>
      if ('in' in obj && Array.isArray(obj.in)) {
        params.push(obj.in.map((v) => String(v)))
        conditions.push(`${col}::text = ANY($${params.length}::text[])`)
        continue
      }
      if ('ne' in obj) {
        if (obj.ne === null) conditions.push(`${col} IS NOT NULL`)
        else {
          params.push(obj.ne)
          conditions.push(`${col} <> $${params.length}`)
        }
        continue
      }
      if ('contains' in obj) {
        params.push(`%${obj.contains}%`)
        conditions.push(`${col} ILIKE $${params.length}`)
        continue
      }
      if ('gte' in obj && obj.gte !== undefined) {
        params.push(obj.gte)
        conditions.push(`${col} >= $${params.length}`)
      }
      if ('lte' in obj && obj.lte !== undefined) {
        params.push(obj.lte)
        conditions.push(`${col} <= $${params.length}`)
      }
      continue
    }
    params.push(cond)
    conditions.push(`${col} = $${params.length}`)
  }
  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

function orderClause(def: EntityDef): string {
  const sortField = def.sortField ? scalarOf(def, def.sortField) : undefined
  if (sortField) return `ORDER BY ${sortField.column} ASC, created_at ASC`
  const timePoint = scalarOf(def, 'timePoint')
  if (timePoint) return `ORDER BY ${timePoint.column} ASC, created_at ASC`
  return `ORDER BY created_at ASC`
}

async function rowToEntity(
  def: EntityDef,
  row: Record<string, unknown>,
  depth: EntityDepth,
  resolver: RefResolver,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { id: row.id }
  for (const field of def.scalars) {
    if (depth === 'index' && !field.inIndex) continue
    out[field.key] = await projectScalar(field, row[field.column], depth, resolver)
  }
  if (depth === 'index') {
    const hint = indexHint(def, row)
    if (hint) out.hint = hint
    return out
  }
  for (const container of def.json ?? []) {
    out[container.key] = parseJsonColumn(row[container.column])
  }
  return out
}

async function projectScalar(
  field: ScalarField,
  raw: unknown,
  depth: EntityDepth,
  resolver: RefResolver,
): Promise<unknown> {
  if (raw == null) return null
  if (field.type === 'ref' && field.ref) return resolver.toNatural(field.ref, String(raw))
  if (field.type === 'int') return Number(raw)
  if (field.type === 'bool') return Boolean(raw)
  const s = String(raw)
  if (field.type === 'longText' && depth !== 'raw' && field.truncateAt && s.length > field.truncateAt) {
    return `${s.slice(0, field.truncateAt)}…`
  }
  return s
}

function indexHint(def: EntityDef, row: Record<string, unknown>): string | undefined {
  if (def.domain === 'role') {
    const factionCol = def.scalars.find((f) => f.key === 'faction')?.column
    if (factionCol) {
      const scalar = String(row[factionCol] ?? '').trim()
      if (scalar) return scalar.slice(0, 40)
    }
  }
  if (!def.indexHintKeys?.length) return undefined
  for (const container of def.json ?? []) {
    const obj = parseJsonColumn(row[container.column])
    for (const key of def.indexHintKeys) {
      const v = obj[key]
      if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 40)
      if (Array.isArray(v) && typeof v[0] === 'string') return String(v[0]).slice(0, 40)
    }
  }
  return undefined
}

type RefResolver = ReturnType<typeof createRefResolver>

function createRefResolver(novelId: string, conn: PGlite) {
  const nameCache = new Map<EntityDomain, Promise<{ byName: Map<string, string[]>; byId: Map<string, string> }>>()
  let chapterCache: Promise<{ noToId: Map<number, string>; idToNo: Map<string, number> }> | null = null

  function loadNameIndex(domain: EntityDomain) {
    const cached = nameCache.get(domain)
    if (cached) return cached
    const task = (async () => {
      const def = getDomainDef(domain)
      const table = tableNameOf(def, novelId)
      const nameField = def.scalars.find((f) => f.key === 'name' || f.key === 'title')
      if (!nameField) return { byName: new Map(), byId: new Map() }
      const { rows } = await conn.query(
        `SELECT id, ${nameField.column} AS label FROM ${table} WHERE novel_id = $1`,
        [novelId],
      )
      const byName = new Map<string, string[]>()
      const byId = new Map<string, string>()
      for (const r of rows) {
        const rec = rowOf(r)
        byId.set(String(rec.id), String(rec.label))
        for (const key of nameKeys(String(rec.label))) {
          const list = byName.get(key) ?? []
          list.push(String(rec.id))
          byName.set(key, list)
        }
      }
      return { byName, byId }
    })()
    nameCache.set(domain, task)
    return task
  }

  function loadChapterIndex() {
    if (chapterCache) return chapterCache
    chapterCache = (async () => {
      const def = getDomainDef('chapter')
      const table = tableNameOf(def, novelId)
      const { rows } = await conn.query(`SELECT id, sort_order FROM ${table} WHERE novel_id = $1`, [novelId])
      const noToId = new Map<number, string>()
      const idToNo = new Map<string, number>()
      for (const r of rows) {
        const rec = rowOf(r)
        const no = Number(rec.sort_order)
        noToId.set(no, String(rec.id))
        idToNo.set(String(rec.id), no)
      }
      return { noToId, idToNo }
    })()
    return chapterCache
  }

  return {
    async toId(field: string, ownerDomain: EntityDomain, ref: RefSpec, value: unknown): Promise<string | null> {
      if (value == null) return null
      const raw = typeof value === 'number' ? String(value) : String(value).trim()
      if (!raw) return null
      if (ref.resolveBy === 'chapterNo') {
        const idx = await loadChapterIndex()
        if (UUID_RE.test(raw)) return idx.idToNo.has(raw) ? raw : null
        const no = Number(raw.replace(/^第\s*|\s*章$/g, ''))
        if (!Number.isFinite(no)) throw refNotFound(ownerDomain, field, value, '章节', [])
        const id = idx.noToId.get(Math.floor(no))
        if (!id) {
          throw refNotFound(
            ownerDomain,
            field,
            value,
            '章节',
            [...idx.noToId.keys()].sort((a, b) => a - b).slice(0, 20).map((n) => ({ id: String(n), name: `第${n}章` })),
          )
        }
        return id
      }
      const idx = await loadNameIndex(ref.domain)
      if (idx.byId.has(raw)) return raw
      if (UUID_RE.test(raw)) {
        throw refNotFound(ownerDomain, field, value, getDomainDef(ref.domain).label, candidatesOf(idx))
      }
      for (const key of nameKeys(raw)) {
        const hit = idx.byName.get(key)
        if (!hit?.length) continue
        if (hit.length > 1) {
          throw refAmbiguous(
            ownerDomain,
            field,
            value,
            hit.map((id) => ({ id, name: idx.byId.get(id) ?? '' })),
          )
        }
        return hit[0]!
      }
      throw refNotFound(ownerDomain, field, value, getDomainDef(ref.domain).label, candidatesOf(idx))
    },
    toNatural(ref: RefSpec, id: string): Promise<number | string | null> {
      if (!id) return Promise.resolve(null)
      if (ref.resolveBy === 'chapterNo') {
        return loadChapterIndex().then((idx) => idx.idToNo.get(id) ?? null)
      }
      return loadNameIndex(ref.domain).then((idx) => idx.byId.get(id) ?? null)
    },
    invalidate(domain: EntityDomain) {
      nameCache.delete(domain)
      if (domain === 'chapter') chapterCache = null
    },
  }
}

function candidatesOf(idx: { byId: Map<string, string> }) {
  return [...idx.byId.entries()].slice(0, 20).map(([id, name]) => ({ id, name }))
}

function nameKeys(label: string): string[] {
  const trimmed = String(label ?? '').trim()
  if (!trimmed) return []
  const normalized = trimmed.toLowerCase().replace(/[\s\u3000·・\-—–~～:：.。]+/g, '')
  return normalized === trimmed ? [trimmed] : [trimmed, normalized]
}

async function resolveNaturalKey(
  novelId: string,
  def: EntityDef,
  natural: string | number,
  resolver: RefResolver,
  db: PGlite,
): Promise<string | null> {
  if (def.domain === 'chapter') {
    return resolver.toId('chapterNo', def.domain, { domain: 'chapter', resolveBy: 'chapterNo' }, natural)
  }
  if (def.domain === 'level') {
    const key = String(natural).trim()
    if (!key) return null
    const { rows } = await db.query(
      `SELECT id FROM ${tableNameOf(def, novelId)} WHERE novel_id = $1 AND system_json->>'name' = $2 LIMIT 1`,
      [novelId, key],
    )
    return rows[0] ? String(rowOf(rows[0])['id']) : null
  }
  const nameField = def.scalars.find((f) => f.key === 'name' || f.key === 'title')
  if (!nameField) return null
  const { rows } = await db.query(
    `SELECT id FROM ${tableNameOf(def, novelId)} WHERE novel_id = $1 AND ${nameField.column} = $2 LIMIT 1`,
    [novelId, String(natural)],
  )
  return rows[0] ? String(rowOf(rows[0])['id']) : null
}

async function applyOne(db: PGlite, novelId: string, op: MutateOp, resolver: RefResolver) {
  const def = getDomainDef(op.domain)
  if (def.storage.kind === 'novelColumn') return updateNovelColumn(db, novelId, def, op)
  if (def.singleton && op.action !== 'update' && op.action !== 'upsert') {
    throw entityError({
      code: 'UNSUPPORTED_ACTION',
      domain: op.domain,
      message: `${def.label}是单例，只支持 action: "update"`,
      received: op.action,
      allowed: ['update'],
    })
  }
  if (op.action === 'delete') return deleteRows(db, novelId, def, op, resolver)
  const data = op.data ?? {}
  let existingId: string | null = null
  let partial = op.action === 'update'
  if (op.action === 'upsert') {
    const peek = await normalizeEntityInput(novelId, op.domain, data, { partial: true })
    await resolveRefs(def, peek, resolver)
    if (op.domain === 'world') await validateWorldParentHierarchy(db, novelId, def, peek, true)
    existingId = await locateRow(db, novelId, def, op, peek, resolver)
    partial = existingId != null
  }
  const input = await normalizeEntityInput(novelId, op.domain, data, { partial })
  await resolveRefs(def, input, resolver)
  if (op.domain === 'world') await validateWorldParentHierarchy(db, novelId, def, input, partial)
  if (op.action !== 'upsert') {
    existingId = await locateRow(db, novelId, def, op, input, resolver)
  } else if (!existingId) {
    existingId = await locateRow(db, novelId, def, op, input, resolver)
  }
  if (op.action === 'create' && existingId) {
    const key = extractBusinessKeyValues(op.domain, input)
    throw entityError({
      code: 'DUPLICATE_BUSINESS_KEY',
      domain: op.domain,
      message: `${def.label}已存在（${JSON.stringify(key)}），请改用 action: "upsert" 或 "update"`,
      received: key,
      suggestion: 'upsert',
      fix: { action: 'upsert', domain: op.domain, data },
    })
  }
  if (op.action === 'update' && !existingId) {
    throw entityNotFound(op.domain, op.match ?? extractBusinessKeyValues(op.domain, input))
  }
  if (existingId) {
    const before = await updateRow(db, novelId, def, existingId, input)
    const result = {
      domain: op.domain,
      action: 'update' as const,
      id: existingId,
      key: extractBusinessKeyValues(op.domain, input),
      before,
      ...(input.notes.length > 0 ? { notes: input.notes } : {}),
    }
    if (def.effects?.includes('bidirectionalRelation')) {
      await ensureReverseRelation(db, novelId, def, input, resolver)
    }
    return result
  }
  const id = await insertRow(db, novelId, def, input)
  if (def.effects?.includes('bidirectionalRelation')) {
    await ensureReverseRelation(db, novelId, def, input, resolver)
  }
  return {
    domain: op.domain,
    action: 'create' as const,
    id,
    key: extractBusinessKeyValues(op.domain, input),
    ...(input.notes.length > 0 ? { notes: input.notes } : {}),
  }
}

async function updateNovelColumn(db: PGlite, novelId: string, def: EntityDef, op: MutateOp) {
  if (op.action === 'delete') {
    throw entityError({
      code: 'UNSUPPORTED_ACTION',
      domain: def.domain,
      message: `${def.label}不可删除，只能更新字段`,
      received: 'delete',
      allowed: ['update'],
    })
  }
  const storage = def.storage
  if (storage.kind !== 'novelColumn') throw new Error('not novelColumn')
  const container = def.json?.[0]
  if (!container) throw entityNotFound(def.domain, { novelId })
  const data = { ...(op.data ?? {}) }
  const titlePatch = data.novelTitle
  delete data.novelTitle
  const input = await normalizeEntityInput(novelId, def.domain, data, { partial: true })
  const { rows } = await db.query(
    `SELECT ${storage.column} AS payload FROM ${storage.table} WHERE novel_id = $1`,
    [novelId],
  )
  const prev = parseJsonColumn(rowOf(rows[0]).payload)
  const merged = deepMerge(prev, (input.json[container.key] as Record<string, unknown>) ?? {})
  if (titlePatch !== undefined) {
    const registry = getRegistryDb()
    await registry.query(`UPDATE novels SET title = $2, updated_at = NOW() WHERE id = $1`, [
      novelId,
      String(titlePatch).trim(),
    ])
  }
  await db.query(
    `UPDATE ${storage.table} SET ${storage.column} = $2::jsonb, updated_at = NOW() WHERE novel_id = $1`,
    [novelId, JSON.stringify(merged)],
  )
  return {
    domain: def.domain,
    action: 'update' as const,
    id: novelId,
    key: { novelId },
    before: prev,
    ...(input.notes.length > 0 ? { notes: input.notes } : {}),
  }
}

async function deleteRows(db: PGlite, novelId: string, def: EntityDef, op: MutateOp, resolver: RefResolver) {
  const table = tableNameOf(def, novelId)
  if (op.all === true && !op.match) {
    const { rows } = await db.query(`SELECT COUNT(*)::int AS c FROM ${table} WHERE novel_id = $1`, [novelId])
    await db.query(`DELETE FROM ${table} WHERE novel_id = $1`, [novelId])
    return { domain: def.domain, action: 'delete' as const, id: '*', key: { deletedCount: Number(rowOf(rows[0]).c ?? 0) } }
  }
  if (!op.match) {
    throw entityError({
      code: 'UNSUPPORTED_ACTION',
      domain: def.domain,
      message: 'delete 必须提供 match 定位条件；确实要清空整个域请显式传 all: true',
      received: op,
      suggestion: { action: 'delete', domain: def.domain, all: true },
    })
  }
  const id = await locateRow(
    db,
    novelId,
    def,
    op,
    await normalizeMatch(novelId, def, op.match, resolver),
    resolver,
  )
  if (!id) throw entityNotFound(def.domain, op.match)
  const { rows: before } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id])
  await db.query(`DELETE FROM ${table} WHERE id = $1`, [id])
  return {
    domain: def.domain,
    action: 'delete' as const,
    id,
    key: op.match,
    ...(before[0] ? { before: before[0] } : {}),
  }
}

async function locateRow(
  db: PGlite,
  novelId: string,
  def: EntityDef,
  op: MutateOp,
  input: NormalizedInput,
  resolver: RefResolver,
): Promise<string | null> {
  const table = tableNameOf(def, novelId)
  const explicitId = String(op.match?.id ?? input.scalars.id ?? '').trim()
  if (explicitId) {
    const { rows } = await db.query(`SELECT id FROM ${table} WHERE id = $1 LIMIT 1`, [explicitId])
    if (!rows[0] && op.action !== 'upsert') throw entityNotFound(def.domain, { id: explicitId })
    return rows[0] ? String(rowOf(rows[0]).id) : null
  }
  if (def.singleton) {
    const { rows } = await db.query(`SELECT id FROM ${table} WHERE novel_id = $1 LIMIT 1`, [novelId])
    return rows[0] ? String(rowOf(rows[0]).id) : null
  }
  const matchSource = op.match ? await normalizeMatch(novelId, def, op.match, resolver) : input
  const keys = businessKeyOf(def, matchSource.scalars as Record<string, unknown>)
  const conditions = [`novel_id = $1`]
  const params: unknown[] = [novelId]
  for (const key of keys) {
    const value = readKeyValue(matchSource, key)
    if (value === undefined || value === null) return null
    params.push(value)
    conditions.push(`${keyToSqlExpr(def, key)} = $${params.length}`)
  }
  const { rows } = await db.query(
    `SELECT id FROM ${table} WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC LIMIT 1`,
    params,
  )
  return rows[0] ? String(rowOf(rows[0]).id) : null
}

async function normalizeMatch(
  novelId: string,
  def: EntityDef,
  match: Record<string, unknown>,
  resolver: RefResolver,
): Promise<NormalizedInput> {
  const input = await normalizeEntityInput(novelId, def.domain, match, { partial: true })
  await resolveRefs(def, input, resolver)
  return input
}

function readKeyValue(input: NormalizedInput, key: string): unknown {
  if (!key.includes('.')) return input.scalars[key]
  const [containerKey, ...rest] = key.split('.')
  const container = input.json[containerKey!]
  if (!container || typeof container !== 'object') return undefined
  return rest.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], container)
}

function keyToSqlExpr(def: EntityDef, key: string): string {
  if (!key.includes('.')) {
    const field = scalarOf(def, key)
    if (!field) throw unknownField(def.domain, key, def.scalars.map((f) => f.key))
    return field.column
  }
  const [containerKey, ...rest] = key.split('.')
  const container = def.json?.find((j) => j.key === containerKey)
  if (!container) throw unknownField(def.domain, containerKey!, (def.json ?? []).map((j) => j.key))
  const path = rest.map((p) => `'${p.replace(/'/g, "''")}'`).join('->')
  return rest.length === 1
    ? `${container.column}->>${path}`
    : `${container.column}->${path.slice(0, path.lastIndexOf('->'))}->>${rest.at(-1)}`
}

async function resolveRefs(def: EntityDef, input: NormalizedInput, resolver: RefResolver) {
  for (const field of def.scalars) {
    if (field.type !== 'ref' || !field.ref) continue
    const value = input.scalars[field.key]
    if (value === undefined) continue
    try {
      input.scalars[field.key] = await resolver.toId(field.key, def.domain, field.ref, value)
    } catch (err) {
      const softChapter =
        field.ref.resolveBy === 'chapterNo' &&
        (field.key === 'relatedChapterNo' || field.key === 'resolveChapterNo')
      if (softChapter && err instanceof EntityError && err.issue.code === 'REF_NOT_FOUND') {
        input.scalars[field.key] = null
        input.notes.push(`「${field.key}」指向的章节不存在（${String(value)}），已清空关联`)
        continue
      }
      throw err
    }
  }
}

async function insertRow(db: PGlite, novelId: string, def: EntityDef, input: NormalizedInput): Promise<string> {
  const table = tableNameOf(def, novelId)
  const id = String(input.scalars.id ?? '').trim() || randomUUID()
  const columns = ['id']
  const placeholders = ['$1']
  const params: unknown[] = [id]
  if (needsNovelIdColumn(def)) {
    columns.push('novel_id')
    params.push(novelId)
    placeholders.push(`$${params.length}`)
  }
  for (const field of def.scalars) {
    if (field.key === 'id') continue
    let value = input.scalars[field.key]
    if (value === undefined && field.readOnly && isAutoSort(def, field)) {
      value = await nextSortOrder(db, table, novelId, def, input)
    }
    if (value === undefined) continue
    columns.push(field.column)
    params.push(value)
    placeholders.push(`$${params.length}`)
  }
  for (const container of def.json ?? []) {
    const value = input.json[container.key]
    if (value === undefined) continue
    columns.push(container.column)
    params.push(JSON.stringify(value))
    placeholders.push(`$${params.length}::jsonb`)
  }
  await db.query(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`, params)
  return id
}

async function updateRow(
  db: PGlite,
  novelId: string,
  def: EntityDef,
  id: string,
  input: NormalizedInput,
): Promise<Record<string, unknown>> {
  const table = tableNameOf(def, novelId)
  const { rows: existing } = await db.query(`SELECT * FROM ${table} WHERE id = $1`, [id])
  const before = existing[0] as Record<string, unknown> | undefined
  if (!before) throw entityNotFound(def.domain, { id })
  const sets: string[] = []
  const params: unknown[] = [id]
  for (const field of def.scalars) {
    if (field.key === 'id' || field.readOnly) continue
    const value = input.scalars[field.key]
    if (value === undefined) continue
    params.push(value)
    sets.push(`${field.column} = $${params.length}`)
  }
  for (const container of def.json ?? []) {
    const patch = input.json[container.key]
    if (patch === undefined) continue
    const prev = parseJsonColumn(before[container.column])
    const merged =
      container.merge === 'replace'
        ? patch
        : container.merge === 'levelTiers'
          ? mergeLevelSystem(prev, patch as Record<string, unknown>)
          : deepMerge(prev, patch as Record<string, unknown>)
    params.push(JSON.stringify(merged))
    sets.push(`${container.column} = $${params.length}::jsonb`)
  }
  if (sets.length === 0) return before
  await db.query(`UPDATE ${table} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`, params)
  return before
}

async function ensureReverseRelation(
  db: PGlite,
  novelId: string,
  def: EntityDef,
  input: NormalizedInput,
  resolver: RefResolver,
) {
  const from = input.scalars.fromRoleId
  const to = input.scalars.toRoleId
  if (!from || !to || from === to) return
  const reverse: NormalizedInput = {
    scalars: { ...input.scalars, fromRoleId: to, toRoleId: from },
    json: input.json,
    notes: [],
  }
  delete reverse.scalars.id
  const table = tableNameOf(def, novelId)
  const { rows } = await db.query(
    `SELECT id FROM ${table} WHERE from_role_id = $1 AND to_role_id = $2 LIMIT 1`,
    [to, from],
  )
  if (rows[0]) await updateRow(db, novelId, def, String(rowOf(rows[0]).id), reverse)
  else await insertRow(db, novelId, def, reverse)
  resolver.invalidate(def.domain)
}

function isAutoSort(def: EntityDef, field: ScalarField): boolean {
  return field.column === 'sort_order' && !def.businessKey.includes(field.key)
}

async function nextSortOrder(
  db: PGlite,
  table: string,
  novelId: string,
  def: EntityDef,
  input: NormalizedInput,
): Promise<number> {
  const scopeField = def.scalars.find(
    (f) => f.type === 'ref' && f.ref && f.key !== 'relatedChapterNo' && f.key !== 'resolveChapterNo',
  )
  const scopeValue = scopeField ? input.scalars[scopeField.key] : undefined
  if (scopeField && scopeValue) {
    const { rows } = await db.query(
      `SELECT MAX(sort_order)::int AS max FROM ${table} WHERE ${scopeField.column} = $1`,
      [scopeValue],
    )
    return (Number(rowOf(rows[0]).max) ?? -1) + 1
  }
  const { rows } = await db.query(`SELECT MAX(sort_order)::int AS max FROM ${table} WHERE novel_id = $1`, [novelId])
  return (Number(rowOf(rows[0]).max) ?? -1) + 1
}

function extractBusinessKeyValues(domain: EntityDomain, input: NormalizedInput): Record<string, unknown> {
  const def = getDomainDef(domain)
  const keys = businessKeyOf(def, input.scalars as Record<string, unknown>)
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (key.includes('.')) {
      const [containerKey, ...rest] = key.split('.')
      const container = input.json[containerKey!]
      out[key] =
        container && typeof container === 'object'
          ? rest.reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], container)
          : undefined
      continue
    }
    out[key] = input.scalars[key]
  }
  return out
}

function mergeLevelSystem(prev: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged = deepMerge({ ...prev, levels: undefined }, patch)
  if (patch.levels === undefined) {
    merged.levels = prev.levels ?? []
    return merged
  }
  merged.levels = mergeLevelTiers(prev.levels, patch.levels)
  return merged
}

function mergeLevelTiers(existingRaw: unknown, patchRaw: unknown): unknown[] {
  const existing = toTierArray(existingRaw)
  const patch = toTierArray(patchRaw)
  const byName = new Map<string, Record<string, unknown>>()
  for (const tier of existing) {
    const name = String(tier?.name ?? '').trim()
    if (name) byName.set(name, { ...tier, name, subLevels: [...((tier.subLevels as unknown[]) ?? [])] })
  }
  for (const tier of patch) {
    const name = String(tier?.name ?? '').trim()
    if (!name) continue
    const prev = byName.get(name)
    if (!prev) {
      byName.set(name, {
        name,
        subLevels: [...((tier.subLevels as unknown[]) ?? [])],
        promotionCondition: tier.promotionCondition ?? '',
        abilities: tier.abilities ?? '',
        ...(tier.lifespan !== undefined ? { lifespan: tier.lifespan } : {}),
      })
      continue
    }
    byName.set(name, {
      name,
      subLevels: mergeSubLevels(prev.subLevels as unknown[], (tier.subLevels as unknown[]) ?? []),
      promotionCondition: nonEmpty(tier.promotionCondition) ?? prev.promotionCondition,
      abilities: nonEmpty(tier.abilities) ?? prev.abilities,
      lifespan: nonEmpty(tier.lifespan) ?? prev.lifespan,
    })
  }
  return [...byName.values()]
}

function toTierArray(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return []
  return raw.filter((x) => x != null && typeof x === 'object') as Array<Record<string, unknown>>
}

function mergeSubLevels(existing: unknown[], patch: unknown[]): unknown[] {
  const byName = new Map<string, Record<string, unknown>>()
  for (const s of existing) {
    const o = s as Record<string, unknown>
    const name = String(o?.name ?? '').trim()
    if (name) byName.set(name, { ...o, name })
  }
  for (const s of patch) {
    const o = s as Record<string, unknown>
    const name = String(o?.name ?? '').trim()
    if (!name) continue
    const prev = byName.get(name)
    byName.set(name, { name, note: nonEmpty(o?.note) ?? prev?.note })
  }
  return [...byName.values()]
}

function nonEmpty(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined
  const s = String(v)
  return s.trim() === '' ? undefined : s
}

async function validateWorldParentHierarchy(
  db: PGlite,
  novelId: string,
  def: EntityDef,
  input: NormalizedInput,
  partial: boolean,
) {
  const kindRaw = input.scalars.kind
  const parentRaw = input.scalars.parentId
  if (partial && kindRaw === undefined && parentRaw === undefined) return
  let kind = kindRaw != null ? String(kindRaw).trim() : ''
  let parentId =
    parentRaw === undefined || parentRaw === null || String(parentRaw).trim() === ''
      ? null
      : String(parentRaw).trim()
  if (partial && (!kind || (parentRaw === undefined && parentId == null))) {
    const name = String(input.scalars.name ?? '').trim()
    if (name) {
      const table = tableNameOf(def, novelId)
      const { rows } = await db.query(
        `SELECT kind, parent_id FROM ${table} WHERE novel_id = $1 AND name = $2 LIMIT 1`,
        [novelId, name],
      )
      const row = rowOf(rows[0])
      if (row) {
        if (!kind) kind = String(row.kind ?? '').trim()
        if (parentRaw === undefined) {
          parentId =
            row.parent_id == null || String(row.parent_id).trim() === ''
              ? null
              : String(row.parent_id).trim()
        }
      }
    }
  }
  if (!kind) return
  const childKind = kind
  if (!(childKind in WORLD_NODE_KIND_LABELS)) return
  let parentKind: string | null = null
  if (parentId) {
    const table = tableNameOf(def, novelId)
    const { rows } = await db.query(`SELECT kind, name FROM ${table} WHERE id = $1 LIMIT 1`, [parentId])
    const row = rowOf(rows[0])
    if (!rows[0]) {
      throw entityError({
        code: 'REF_NOT_FOUND',
        domain: 'world',
        field: 'parentId',
        message: 'world.parentId 指向的节点不存在，请先创建父节点或改用已有名称',
        received: parentId,
      })
    }
    parentKind = String(row.kind)
  }
  if (isAllowedWorldParentChild(parentKind, childKind)) return
  const allowed = allowedParentKinds(childKind)
  const table = tableNameOf(def, novelId)
  let candidates: Array<{ id: string; name: string }> = []
  if (allowed.length > 0) {
    const { rows } = await db.query(
      `SELECT id, name, kind FROM ${table} WHERE novel_id = $1 AND kind = ANY($2::text[]) ORDER BY kind ASC, name ASC LIMIT 20`,
      [novelId, allowed],
    )
    candidates = rows.map((r) => {
      const rec = rowOf(r)
      return {
        id: String(rec.id),
        name: `${rec.name}（${WORLD_NODE_KIND_LABELS[String(rec.kind)] ?? rec.kind}）`,
      }
    })
  }
  const childLabel = WORLD_NODE_KIND_LABELS[childKind] ?? childKind
  if (parentKind == null) {
    throw entityError({
      code: 'CONSTRAINT_VIOLATION',
      domain: 'world',
      field: 'parentId',
      message:
        `world「${childLabel}」不能挂在根上，须指定 parentId/parentName（先建父级地理/政区再挂城市或势力）` +
        (canBeWorldRoot(childKind) ? '' : '；仅 universe/multiverse/custom 可作根'),
      received: { kind: childKind, parentId: null },
      allowed: allowed.map((k) => `${k}(${WORLD_NODE_KIND_LABELS[k]})`),
      candidates,
      suggestion: candidates[0]?.id,
    })
  }
  const parentLabel = WORLD_NODE_KIND_LABELS[parentKind] ?? parentKind
  throw entityError({
    code: 'CONSTRAINT_VIOLATION',
    domain: 'world',
    field: 'parentId',
    message: `world「${childLabel}」不能挂在「${parentLabel}」下，请改挂到合法父级（层差过大或同层顺序不符）`,
    received: { kind: childKind, parentKind },
    allowed: allowed.map((k) => `${k}(${WORLD_NODE_KIND_LABELS[k]})`),
    candidates,
    suggestion: candidates[0]?.id,
  })
}

async function normalizeEntityInput(
  novelId: string,
  domain: EntityDomain,
  raw: Record<string, unknown>,
  options: { partial?: boolean } = {},
): Promise<NormalizedInput> {
  const def = getDomainDef(domain)
  const config = await loadTemplateConfig(novelId)
  const notes: string[] = []
  const scalars: Record<string, unknown> = {}
  const json: Record<string, unknown> = {}
  const flat = applyDomainInputAliases(def, { ...raw }, notes)
  for (const [key, value] of Object.entries(flat)) {
    if (value === undefined) continue
    if (key === 'id') {
      scalars.id = String(value)
      continue
    }
    const scalar = scalarOf(def, key)
    if (scalar) {
      if (scalar.readOnly) {
        notes.push(`${key} 由系统维护，已忽略传入值`)
        continue
      }
      scalars[key] = coerceScalar(def, scalar, value, notes)
      continue
    }
    const container = jsonFieldOf(def, key)
    if (container) {
      json[key] = coerceContainer(def, container, value, config, flat, notes)
      continue
    }
    const placed = placeIntoContainer(def, config, flat, key, value, json, notes)
    if (placed) continue
    if (domain === 'role' && key === 'hint') {
      const factionField = scalarOf(def, 'faction')
      if (factionField) {
        scalars.faction = coerceScalar(def, factionField, value, notes)
        notes.push('hint 为索引只读投影，已按 faction 写入')
        continue
      }
    }
    const known = knownWritableFieldKeys(def, config, flat)
    const near = closestMatch(key, known)
    if (near) {
      notes.push(`字段「${key}」已按最相近的「${near}」处理`)
      if (near.includes('.')) {
        placeIntoContainer(def, config, flat, near, value, json, notes)
        continue
      }
      const s = scalarOf(def, near)
      if (s) scalars[near] = coerceScalar(def, s, value, notes)
      else {
        const c = jsonFieldOf(def, near)
        if (c) json[near] = coerceContainer(def, c, value, config, flat, notes)
      }
      continue
    }
    throw unknownField(domain, key, known)
  }
  applyDefaults(def, scalars, json, options)
  if (domain === 'level') {
    const systemContainer = def.json?.find((j) => j.shape === 'levelSystem')
    if (systemContainer && json[systemContainer.key]) {
      json[systemContainer.key] = coerceLevelSystem(
        def,
        systemContainer,
        json[systemContainer.key] as Record<string, unknown>,
        notes,
      )
    }
  }
  if (domain === 'role') {
    liftRoleFactionFromProfile(scalars, json, notes)
    if (scalars.faction !== undefined) {
      json.profile = { ...(json.profile as Record<string, unknown> | undefined), faction: '' }
    }
    await validateRoleAffiliation(novelId, scalars)
  }
  if (!options.partial) {
    for (const f of def.scalars) {
      if (!f.required || f.readOnly) continue
      const v = scalars[f.key]
      if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
        throw missingRequired(domain, f.key, f.label)
      }
    }
  }
  return { scalars, json, notes }
}

const AFFILIATED_TIMELINE_DOMAINS = new Set<EntityDomain>([
  'roleTimeline',
  'itemTimeline',
  'creatureTimeline',
  'worldTimeline',
])
const AFFILIATED_TIMELINE_OWNER_KEY: Partial<Record<EntityDomain, string>> = {
  roleTimeline: 'roleId',
  itemTimeline: 'itemId',
  creatureTimeline: 'creatureId',
  worldTimeline: 'worldNodeId',
}
const OUTLINE_EXTRA_TOP_KEYS = ['theme', 'conflict', 'majorEvents']
const ROLE_AFFILIATION_KINDS = new Set(['faction', 'city', 'town', 'settlement'])

function applyDomainInputAliases(
  def: EntityDef,
  raw: Record<string, unknown>,
  notes: string[],
): Record<string, unknown> {
  const out = { ...raw }
  if ('domain' in out) {
    delete out.domain
    notes.push('已忽略 data 内的 domain（应写在 operation 顶层）')
  }
  if (def.domain === 'overview' && 'category' in out) {
    delete out.category
    notes.push('category 为只读题材字段，已忽略')
  }
  if (def.domain === 'world') {
    if ('type' in out) {
      delete out.type
      notes.push('已忽略 type（世界节点类型请用 kind）')
    }
    if (
      out.parentName != null &&
      String(out.parentName).trim() !== '' &&
      (out.parentId == null || String(out.parentId).trim() === '')
    ) {
      out.parentId = out.parentName
      notes.push('parentName 已映射为 parentId')
    }
    delete out.parentName
  }
  if (def.domain === 'roleRelation') {
    if (out.fromName != null && String(out.fromName).trim() !== '' && !out.fromRoleId) {
      out.fromRoleId = out.fromName
      notes.push('fromName 已映射为 fromRoleId')
    }
    if (out.toName != null && String(out.toName).trim() !== '' && !out.toRoleId) {
      out.toRoleId = out.toName
      notes.push('toName 已映射为 toRoleId')
    }
    delete out.fromName
    delete out.toName
  }
  if (AFFILIATED_TIMELINE_DOMAINS.has(def.domain)) {
    const ownerKey = AFFILIATED_TIMELINE_OWNER_KEY[def.domain]
    if (ownerKey && out.name != null && String(out.name).trim() !== '' && !out[ownerKey]) {
      out[ownerKey] = out.name
      notes.push(`name 已映射为 ${ownerKey}`)
    }
    delete out.name
  }
  if (def.domain === 'outline') {
    if (out.volumeNo != null && !out.ordinal) {
      out.ordinal = out.volumeNo
      if (!out.kind) out.kind = 'volume'
      notes.push('volumeNo 已映射为 ordinal（缺 kind 时默认 volume）')
    }
    if (out.chapterNo != null && !out.ordinal) {
      out.ordinal = out.chapterNo
      if (!out.kind) out.kind = 'chapter_segment'
      notes.push('chapterNo 已映射为 ordinal（缺 kind 时默认 chapter_segment）')
    }
    delete out.volumeNo
    delete out.chapterNo
    for (const key of OUTLINE_EXTRA_TOP_KEYS) {
      if (out[key] === undefined) continue
      const extra = (out.extra as Record<string, unknown> | undefined) ?? {}
      if (extra[key] === undefined) {
        extra[key] = out[key]
        notes.push(`顶层「${key}」已收进 extra.${key}`)
      }
      out.extra = extra
      delete out[key]
    }
  }
  if (def.domain === 'timeline') {
    if (!out.title && out.name) {
      out.title = out.name
      notes.push('name 已映射为 title')
    }
    delete out.name
  }
  if (AFFILIATED_TIMELINE_DOMAINS.has(def.domain) || def.domain === 'timeline') {
    coerceTimelineTimePoint(out, notes)
  }
  return out
}

function coerceTimelineTimePoint(out: Record<string, unknown>, notes: string[]) {
  const tp = out.timePoint
  const hasLabel = out.timeLabel != null && String(out.timeLabel).trim() !== ''
  if (tp !== undefined && tp !== null && String(tp).trim() !== '') {
    const asInt = coerceStrictTimePointInt(tp)
    if (asInt !== undefined) {
      if (typeof tp !== 'number' || tp !== asInt) {
        out.timePoint = asInt
        notes.push('timePoint 已规范为整数')
      }
      return
    }
    const label = String(tp).trim()
    if (!hasLabel) {
      out.timeLabel = label
      notes.push('非数字 timePoint 已升为 timeLabel，timePoint 缺省为 0')
    } else {
      notes.push('非数字 timePoint 已忽略，缺省为 0')
    }
    out.timePoint = 0
    return
  }
  if (hasLabel && (tp === undefined || tp === null || String(tp).trim() === '')) {
    out.timePoint = 0
    notes.push('缺 timePoint，已按 timeLabel 缺省为 0')
  }
}

function coerceStrictTimePointInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  const s = String(value ?? '').trim()
  if (!s) return undefined
  if (/^-?\d+$/.test(s)) {
    const n = Number(s)
    if (Number.isFinite(n)) return Math.floor(n)
  }
  const m = s.match(/^第\s*(\d+)\s*[章卷回节]\s*$/)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n)) return Math.floor(n)
  }
  return undefined
}

function liftRoleFactionFromProfile(
  scalars: Record<string, unknown>,
  json: Record<string, unknown>,
  notes: string[],
) {
  const profile = json.profile as Record<string, unknown> | undefined
  const hasScalar =
    scalars.faction !== undefined && scalars.faction !== null && String(scalars.faction).trim() !== ''
  if (profile && typeof profile === 'object') {
    const fromFaction = String(profile.faction ?? '').trim()
    const fromOrg = String(profile.organization ?? '').trim()
    if (!hasScalar) {
      const lifted = fromFaction || fromOrg
      if (lifted) {
        scalars.faction = lifted
        notes.push(
          fromFaction
            ? '已将 profile.faction 提升为所属势力标量 faction'
            : '已将 profile.organization 提升为所属势力标量 faction',
        )
      }
    }
    if ('faction' in profile) {
      json.profile = { ...profile, faction: '' }
    }
  }
  if (scalars.faction !== undefined && scalars.faction !== null) {
    scalars.faction = String(scalars.faction).trim()
  }
}

async function validateRoleAffiliation(novelId: string, scalars: Record<string, unknown>) {
  if (scalars.faction === undefined) return
  const name = String(scalars.faction ?? '').trim()
  scalars.faction = name
  if (!name) return
  const db = await ensureNovelTables(novelId)
  const worldTable = tableNameOf(getDomainDef('world'), novelId)
  const { rows } = await db.query(
    `SELECT name, kind FROM ${worldTable} WHERE novel_id = $1 AND name = $2 LIMIT 1`,
    [novelId, name],
  )
  const hit = rowOf(rows[0])
  if (rows[0] && hit && ROLE_AFFILIATION_KINDS.has(String(hit.kind))) return
  const { rows: candidates } = await db.query(
    `SELECT name, kind FROM ${worldTable} WHERE novel_id = $1 AND kind = ANY($2::text[]) ORDER BY kind ASC, name ASC LIMIT 40`,
    [novelId, [...ROLE_AFFILIATION_KINDS]],
  )
  throw refNotFound(
    'role',
    'faction',
    name,
    '世界势力或城市',
    candidates.map((c) => {
      const rec = rowOf(c)
      return {
        id: String(rec.kind),
        name: `${rec.name}（${rec.kind === 'faction' ? '势力' : '城市'}）`,
      }
    }),
  )
}

function knownWritableFieldKeys(
  def: EntityDef,
  config: FormTemplateConfig,
  flat: Record<string, unknown>,
): string[] {
  const kind = def.discriminator ? String(flat[def.discriminator] ?? '') : undefined
  const keys = [
    ...def.scalars.filter((f) => !f.readOnly).map((f) => f.key),
    ...(def.json ?? []).map((f) => f.key),
  ]
  for (const j of def.json ?? []) {
    if (j.shape === 'worldDetail') {
      for (const k of WORLD_DETAIL_KEYS) keys.push(`${j.key}.${k}`)
    }
    if (j.shape === 'levelSystem') {
      keys.push(`${j.key}.name`, `${j.key}.category`, `${j.key}.description`, `${j.key}.levels`)
    }
    const kinds = j.templatePathByKind ? Object.keys(j.templatePathByKind) : [undefined]
    const seen = new Set<string>()
    for (const k of kinds) {
      for (const tf of templateFieldsFor(config, j, k ?? kind)) {
        const dotted = `${j.key}.${tf.key}`
        if (seen.has(dotted)) continue
        seen.add(dotted)
        keys.push(dotted)
      }
    }
  }
  return keys
}

function placeIntoContainer(
  def: EntityDef,
  config: FormTemplateConfig,
  flat: Record<string, unknown>,
  key: string,
  value: unknown,
  json: Record<string, unknown>,
  notes: string[],
): boolean {
  const kind = def.discriminator ? String(flat[def.discriminator] ?? '') : undefined
  const dot = key.indexOf('.')
  if (dot > 0) {
    const containerKey = key.slice(0, dot)
    const subKey = key.slice(dot + 1)
    const container = def.json?.find((c) => c.key === containerKey)
    if (container && subKey && !subKey.includes('.')) {
      if (
        (container.shape === 'worldDetail' && WORLD_DETAIL_KEYS.includes(subKey as typeof WORLD_DETAIL_KEYS[number])) ||
        (container.shape === 'levelSystem' && ['name', 'category', 'description', 'levels'].includes(subKey)) ||
        templateFieldsFor(config, container, kind).some((f) => f.key === subKey)
      ) {
        json[containerKey] = { ...((json[containerKey] as Record<string, unknown>) ?? {}), [subKey]: value }
        notes.push(`已将「${key}」收进 ${containerKey}`)
        return true
      }
    }
    return false
  }
  for (const container of def.json ?? []) {
    if (container.shape === 'worldDetail' && WORLD_DETAIL_KEYS.includes(key as typeof WORLD_DETAIL_KEYS[number])) {
      json[container.key] = { ...((json[container.key] as Record<string, unknown>) ?? {}), [key]: value }
      notes.push(`已将顶层「${key}」收进 ${container.key}`)
      return true
    }
    if (container.shape === 'levelSystem' && ['name', 'category', 'description', 'levels'].includes(key)) {
      json[container.key] = { ...((json[container.key] as Record<string, unknown>) ?? {}), [key]: value }
      notes.push(`已将顶层「${key}」收进 ${container.key}`)
      return true
    }
    if (templateFieldsFor(config, container, kind).some((f) => f.key === key)) {
      json[container.key] = { ...((json[container.key] as Record<string, unknown>) ?? {}), [key]: value }
      notes.push(`已将顶层「${key}」收进 ${container.key}`)
      return true
    }
  }
  return false
}

function applyDefaults(
  def: EntityDef,
  scalars: Record<string, unknown>,
  json: Record<string, unknown>,
  options: { partial?: boolean },
) {
  if (options.partial) return
  for (const f of def.scalars) {
    if (f.default === undefined || f.readOnly) continue
    if (scalars[f.key] === undefined) scalars[f.key] = f.default
  }
  for (const container of def.json ?? []) {
    if (container.shape === 'worldDetail' && json[container.key]) {
      json[container.key] = { ...emptyWorldNodeDetail(), ...(json[container.key] as Record<string, unknown>) }
    }
  }
}

function coerceScalar(def: EntityDef, field: ScalarField, value: unknown, notes: string[]): unknown {
  if (value === null) {
    if (field.nullable) return null
    throw invalidType(def.domain, field.key, null, field.type)
  }
  switch (field.type) {
    case 'int': {
      const n = coerceInt(value)
      if (n === undefined) throw invalidType(def.domain, field.key, value, '整数')
      return n
    }
    case 'bool': {
      if (typeof value === 'boolean') return value
      const s = String(value).trim().toLowerCase()
      if (['true', '1', 'yes', '是', 'y'].includes(s)) return true
      if (['false', '0', 'no', '否', 'n'].includes(s)) return false
      throw invalidType(def.domain, field.key, value, '布尔值')
    }
    case 'enum': {
      const allowed = field.values ?? []
      const s = String(value).trim()
      if (allowed.includes(s)) return s
      const norm = s.toLowerCase().replace(/[\s-]+/g, '_')
      if (allowed.includes(norm)) return norm
      const alias = field.aliases?.[s] ?? field.aliases?.[norm]
      if (alias && allowed.includes(alias)) {
        notes.push(`${field.key}「${s}」已映射为 ${alias}`)
        return alias
      }
      const near = closestMatch(norm, [...allowed])
      if (near) {
        notes.push(`${field.key}「${s}」已按最相近的 ${near} 处理`)
        return near
      }
      throw invalidEnum(def.domain, field.key, value, [...allowed], field.valueLabels)
    }
    case 'ref': {
      if (typeof value === 'number') return String(Math.floor(value))
      const s = String(value).trim()
      return s === '' ? null : s
    }
    default: {
      if (typeof value === 'string') return value
      if (Array.isArray(value)) {
        notes.push(`${field.key} 收到数组，已用换行拼接为文本`)
        return value.map((v) => String(v)).join('\n')
      }
      if (typeof value === 'object') throw invalidType(def.domain, field.key, value, '文本')
      return String(value)
    }
  }
}

function coerceInt(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  const s = String(value ?? '').trim()
  if (!s) return undefined
  const direct = Number(s)
  if (Number.isFinite(direct)) return Math.floor(direct)
  const m = s.match(/第\s*(\d+)\s*[章卷回节]/) || s.match(/(-?\d+)/)
  if (m) {
    const n = Number(m[1])
    if (Number.isFinite(n)) return Math.floor(n)
  }
  return undefined
}

function coerceContainer(
  def: EntityDef,
  container: JsonField,
  value: unknown,
  config: FormTemplateConfig,
  flat: Record<string, unknown>,
  notes: string[],
): Record<string, unknown> {
  let obj = value
  if (typeof obj === 'string') {
    const trimmed = obj.trim()
    if (!trimmed) return {}
    obj = JSON.parse(trimmed)
    notes.push(`${container.key} 收到 JSON 字符串，已解析为对象`)
  }
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) {
    throw entityError({
      code: 'INVALID_STRUCTURE',
      domain: def.domain,
      field: container.key,
      message: `${container.key} 必须是对象`,
      received: obj,
    })
  }
  const rec = obj as Record<string, unknown>
  if (container.shape === 'levelSystem') return coerceLevelSystem(def, container, rec, notes)
  if (container.shape === 'worldDetail') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rec)) {
      if (!WORLD_DETAIL_KEYS.includes(k as typeof WORLD_DETAIL_KEYS[number])) continue
      out[k] = typeof v === 'string' ? v : String(v ?? '')
    }
    return out
  }
  const kind = def.discriminator ? String(flat[def.discriminator] ?? '') : undefined
  const fields = templateFieldsFor(config, container, kind)
  if (fields.length === 0) return rec
  const allowedKeys = new Set(fields.map((f) => f.key))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rec)) {
    if (allowedKeys.has(k)) {
      out[k] = coerceTemplateValue(def, container, fields.find((f) => f.key === k)!, v, notes)
      continue
    }
    const near = closestMatch(k, [...allowedKeys])
    if (near) {
      notes.push(`${container.key}.${k} 已按最相近的 ${near} 处理`)
      out[near] = coerceTemplateValue(def, container, fields.find((f) => f.key === near)!, v, notes)
      continue
    }
    throw unknownField(`${def.domain}.${container.key}`, k, [...allowedKeys])
  }
  return out
}

function coerceTemplateValue(
  def: EntityDef,
  container: JsonField,
  field: { key: string; component?: string; multiple?: boolean; allowCreate?: boolean; options?: unknown[] },
  value: unknown,
  notes: string[],
): unknown {
  const path = `${container.key}.${field.key}`
  if (value == null) return field.multiple ? [] : ''
  if (field.component === 'switch') {
    if (typeof value === 'boolean') return value
    const s = String(value).trim().toLowerCase()
    if (['true', '1', '是'].includes(s)) return true
    if (['false', '0', '否'].includes(s)) return false
    throw invalidType(def.domain, path, value, '布尔值')
  }
  if (field.component === 'inputNumber') {
    const n = coerceInt(value)
    if (n === undefined) throw invalidType(def.domain, path, value, '数字')
    return n
  }
  const allowed = optionValuesOf(field)
  if (field.multiple || field.component === 'tagInput') {
    const arr = Array.isArray(value)
      ? value.map((v) => String(v).trim()).filter(Boolean)
      : String(value)
          .split(/[,，、\n]/)
          .map((v) => v.trim())
          .filter(Boolean)
    if (!Array.isArray(value)) notes.push(`${path} 收到字符串，已按分隔符拆成数组`)
    if (allowed.length > 0 && !field.allowCreate) {
      return arr.map((v) => matchAllowed(def, path, v, allowed, notes))
    }
    return arr
  }
  const s = typeof value === 'string' ? value : String(value)
  if (allowed.length > 0 && !field.allowCreate) return matchAllowed(def, path, s.trim(), allowed, notes)
  return s
}

function matchAllowed(
  def: EntityDef,
  path: string,
  value: string,
  allowed: string[],
  notes: string[],
): string {
  if (allowed.includes(value)) return value
  const near = closestMatch(value, allowed)
  if (near) {
    notes.push(`${path}「${value}」已按最相近的「${near}」处理`)
    return near
  }
  throw invalidEnum(def.domain, path, value, allowed)
}

function coerceLevelSystem(
  def: EntityDef,
  container: JsonField,
  rec: Record<string, unknown>,
  notes: string[],
): Record<string, unknown> {
  const empty = emptyLevelSystem()
  const out: Record<string, unknown> = {
    name: String(rec.name ?? empty.name).trim(),
    category: String(rec.category ?? '').trim(),
    description: String(rec.description ?? ''),
  }
  const rawLevels = rec.levels ?? rec.tiers ?? rec.ranks ?? rec.grades ?? rec['等级']
  if (rawLevels === undefined) return out
  if (!Array.isArray(rawLevels)) {
    throw entityError({
      code: 'INVALID_STRUCTURE',
      domain: def.domain,
      field: `${container.key}.levels`,
      message: 'levels 必须是数组',
      received: rawLevels,
    })
  }
  out.levels = rawLevels.map((lv, i) => {
    if (typeof lv === 'string') {
      notes.push(`levels[${i}] 收到字符串，已作为阶梯名处理`)
      return { name: lv, subLevels: [], promotionCondition: '', abilities: '' }
    }
    const o = lv as Record<string, unknown>
    const subRaw = o.subLevels ?? o.sub ?? []
    let subLevels: unknown[] = []
    if (Array.isArray(subRaw)) {
      subLevels = subRaw.map((s) =>
        typeof s === 'string' ? { name: s } : { name: String((s as Record<string, unknown>)?.name ?? ''), note: String((s as Record<string, unknown>)?.note ?? '') || undefined },
      )
    }
    return {
      name: String(o.name ?? ''),
      subLevels,
      promotionCondition: String(o.promotionCondition ?? ''),
      abilities: String(o.abilities ?? ''),
      ...(o.lifespan !== undefined ? { lifespan: String(o.lifespan) } : {}),
    }
  })
  return out
}
