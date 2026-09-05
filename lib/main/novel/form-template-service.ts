import { randomUUID } from 'node:crypto'
import { getNovelDb } from '@/lib/main/db/novel-db-pool'
import {
  coerceFormTemplateConfig,
  emptyFormTemplateConfig,
} from '@/lib/main/novel/data/entity-schema'
import type { FormTemplateConfig } from '@/lib/main/novel/data/entity-types'
import { createNovelSupportTables } from '@/lib/main/novel/data/entity-ddl'

async function ensureSupportTables(novelId: string) {
  const db = await getNovelDb(novelId)
  await createNovelSupportTables(db)
  return db
}

export async function getFormTemplate(novelId: string): Promise<FormTemplateConfig> {
  const db = await ensureSupportTables(novelId)
  const { rows } = await db.query(
    `SELECT config FROM form_templates ORDER BY updated_at DESC LIMIT 1`,
  )
  const row = rows[0] as { config?: unknown } | undefined
  return coerceFormTemplateConfig(row?.config ?? null)
}

export async function updateFormTemplate(
  novelId: string,
  config: FormTemplateConfig,
): Promise<FormTemplateConfig> {
  const db = await ensureSupportTables(novelId)
  const normalized = coerceFormTemplateConfig(config)
  const { rows } = await db.query(`SELECT id FROM form_templates ORDER BY updated_at DESC LIMIT 1`)
  const existing = rows[0] as { id?: string } | undefined
  if (existing?.id) {
    await db.query(
      `UPDATE form_templates SET config = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(normalized), existing.id],
    )
  } else {
    await db.query(`INSERT INTO form_templates (id, config) VALUES ($1, $2::jsonb)`, [
      randomUUID(),
      JSON.stringify(normalized),
    ])
  }
  return normalized
}

export async function clearOverviewBlueprint(novelId: string): Promise<{ ok: true }> {
  const { mutateEntities } = await import('@/lib/main/novel/data/entity-repo')
  await mutateEntities(novelId, [
    {
      domain: 'overview',
      action: 'update',
      data: { blueprint: {} },
    },
  ])
  return { ok: true }
}

export { emptyFormTemplateConfig }
