import type { PGlite } from '@electric-sql/pglite'
import {
  ddlTypeOf,
  getDomainDef,
  keyExpr,
  perNovelDomains,
  scalarOf,
  tableNameOf,
} from './entity-schema'
import type { EntityDef } from './entity-types'

function columnDdl(def: EntityDef, table: string): string[] {
  const cols = ['id TEXT PRIMARY KEY', 'novel_id TEXT NOT NULL']
  for (const field of def.scalars) {
    if (field.key === 'id') continue
    const type = ddlTypeOf(field)
    if (field.key === def.parentField) {
      cols.push(`${field.column} TEXT REFERENCES ${table}(id) ON DELETE CASCADE`)
      continue
    }
    if (field.nullable || field.type === 'ref') {
      cols.push(`${field.column} ${type}`)
      continue
    }
    const fallback =
      field.type === 'int' ? '0' : field.type === 'bool' ? 'false' : `'${String(field.default ?? '').replace(/'/g, "''")}'`
    cols.push(`${field.column} ${type} NOT NULL DEFAULT ${fallback}`)
  }
  for (const container of def.json ?? []) {
    cols.push(`${container.column} JSONB NOT NULL DEFAULT '{}'::jsonb`)
  }
  cols.push('created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  cols.push('updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  return cols
}

function uniqueIndexes(def: EntityDef, table: string): string[] {
  const out: string[] = []
  const emit = (name: string, keys: string[], where?: string) => {
    if (keys.length === 0) return
    const exprs = keys.map((k) => keyExpr(def, k)).filter(Boolean)
    if (exprs.length !== keys.length) return
    out.push(
      `CREATE UNIQUE INDEX IF NOT EXISTS ${name} ON ${table} (${exprs.join(', ')})${where ? ` WHERE ${where}` : ''};`,
    )
  }

  if (def.businessKeyByKind && def.discriminator) {
    const disc = scalarOf(def, def.discriminator)
    for (const [kind, keys] of Object.entries(def.businessKeyByKind)) {
      if (!disc) continue
      emit(
        `uq_${table}_${kind}`,
        keys.filter((k) => k !== def.discriminator),
        `${disc.column} = '${kind}'`,
      )
    }
    return out
  }

  const nameField =
    def.businessKey.length === 1 ? scalarOf(def, def.businessKey[0]) : undefined
  emit(
    `uq_${table}_key`,
    def.businessKey,
    nameField?.type === 'text' ? `${nameField.column} <> ''` : undefined,
  )
  return out
}

function lookupIndexes(def: EntityDef, table: string): string[] {
  const out = [`CREATE INDEX IF NOT EXISTS idx_${table}_novel ON ${table} (novel_id);`]
  for (const field of def.scalars) {
    if (field.type !== 'ref' || !field.ref) continue
    out.push(`CREATE INDEX IF NOT EXISTS idx_${table}_${field.column} ON ${table} (${field.column});`)
  }
  const timePoint = scalarOf(def, 'timePoint')
  if (timePoint) {
    out.push(`CREATE INDEX IF NOT EXISTS idx_${table}_tp ON ${table} (novel_id, ${timePoint.column});`)
  }
  const faction = scalarOf(def, 'faction')
  if (def.domain === 'role' && faction) {
    out.push(`CREATE INDEX IF NOT EXISTS idx_${table}_faction ON ${table} (novel_id, ${faction.column});`)
  }
  return out
}

function createTableSql(def: EntityDef, novelId: string): string {
  const table = tableNameOf(def, novelId)
  return `CREATE TABLE IF NOT EXISTS ${table} (
  ${columnDdl(def, table).join(',\n  ')}
);`
}

export async function createNovelSupportTables(db: PGlite): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS form_templates (
      id TEXT PRIMARY KEY,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS novel_blueprint (
      novel_id TEXT PRIMARY KEY,
      blueprint_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS novel_skills (
      id TEXT PRIMARY KEY,
      novel_id TEXT NOT NULL,
      category TEXT,
      title TEXT NOT NULL,
      section TEXT NOT NULL,
      skill_type TEXT NOT NULL DEFAULT 'skill',
      agent_kind TEXT NOT NULL DEFAULT 'write',
      parent_id TEXT,
      content TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_novel_skills_section ON novel_skills (section);
    CREATE INDEX IF NOT EXISTS idx_novel_skills_agent_kind ON novel_skills (agent_kind);
  `)
}

export async function createNovelEntityTables(db: PGlite, novelId: string): Promise<void> {
  for (const def of perNovelDomains()) {
    await db.exec(createTableSql(def, novelId))
  }
  await ensureRoleFactionColumn(db, novelId)
  await ensureOwnerNameColumns(db, novelId)
  for (const def of perNovelDomains()) {
    for (const sql of lookupIndexes(def, tableNameOf(def, novelId))) {
      await db.exec(sql)
    }
  }
}

async function ensureRoleFactionColumn(db: PGlite, novelId: string): Promise<void> {
  const def = getDomainDef('role')
  const table = tableNameOf(def, novelId)
  await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS faction TEXT;`)
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_faction ON ${table} (novel_id, faction);`)
  await db.exec(`
    UPDATE ${table}
    SET faction = COALESCE(
      NULLIF(trim(faction), ''),
      NULLIF(trim(profile_json->>'faction'), ''),
      NULLIF(trim(profile_json->>'organization'), '')
    )
    WHERE (faction IS NULL OR trim(faction) = '')
      AND (
        NULLIF(trim(profile_json->>'faction'), '') IS NOT NULL
        OR NULLIF(trim(profile_json->>'organization'), '') IS NOT NULL
      );
  `)
}

async function ensureOwnerNameColumns(db: PGlite, novelId: string): Promise<void> {
  const creatures = tableNameOf(getDomainDef('creature'), novelId)
  const items = tableNameOf(getDomainDef('item'), novelId)
  const roles = tableNameOf(getDomainDef('role'), novelId)
  await db.exec(`ALTER TABLE ${creatures} ADD COLUMN IF NOT EXISTS owner TEXT;`)
  await db.exec(`ALTER TABLE ${items} ADD COLUMN IF NOT EXISTS owner TEXT;`)
  try {
    await db.exec(`
      UPDATE ${creatures} AS c
      SET owner = r.name
      FROM ${roles} AS r
      WHERE (c.owner IS NULL OR trim(c.owner) = '')
        AND c.owner_id IS NOT NULL
        AND trim(c.owner_id::text) <> ''
        AND r.id = c.owner_id::text
        AND r.novel_id = c.novel_id;
    `)
  } catch {
    // owner_id column may not exist on fresh schemas
  }
}

export async function createNovelEntityUniqueIndexes(db: PGlite, novelId: string): Promise<void> {
  for (const def of perNovelDomains()) {
    for (const sql of uniqueIndexes(def, tableNameOf(def, novelId))) {
      await db.exec(sql)
    }
  }
}

export async function ensureNovelBlueprintRow(db: PGlite, novelId: string): Promise<void> {
  await db.query(
    `INSERT INTO novel_blueprint (novel_id, blueprint_json) VALUES ($1, '{}'::jsonb)
     ON CONFLICT (novel_id) DO NOTHING`,
    [novelId],
  )
}

export async function dropNovelEntityTables(db: PGlite): Promise<void> {
  for (const def of [...perNovelDomains()].reverse()) {
    await db.exec(`DROP TABLE IF EXISTS ${tableNameOf(def)} CASCADE;`)
  }
}
