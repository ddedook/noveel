#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { createNovelSupportTables } from '../lib/main/novel/data/entity-ddl'
import { seedDefaultSkills, backfillMissingSkills } from '../lib/main/novel/skill-seed'

const NOVEL_ID = 'skill-seed-test'

async function countWhere(db: PGlite, sql: string, params: unknown[]): Promise<number> {
  const { rows } = await db.query<{ c: number }>(sql, params)
  return rows[0]?.c ?? 0
}

async function assertSeed(db: PGlite): Promise<void> {
  const chaptersWrite = await countWhere(
    db,
    `SELECT COUNT(*)::int AS c FROM novel_skills WHERE novel_id = $1 AND section = 'chapters' AND agent_kind = 'write'`,
    [NOVEL_ID],
  )
  const reviewTotal = await countWhere(
    db,
    `SELECT COUNT(*)::int AS c FROM novel_skills WHERE novel_id = $1 AND agent_kind = 'review'`,
    [NOVEL_ID],
  )
  const outlineReview = await countWhere(
    db,
    `SELECT COUNT(*)::int AS c FROM novel_skills WHERE novel_id = $1 AND section = 'outline' AND agent_kind = 'review'`,
    [NOVEL_ID],
  )

  console.log('chapters write:', chaptersWrite)
  console.log('review total:', reviewTotal)
  console.log('outline review:', outlineReview)

  if (chaptersWrite < 5) throw new Error(`expected chapters write >= 5, got ${chaptersWrite}`)
  if (reviewTotal < 2) throw new Error(`expected review total >= 2, got ${reviewTotal}`)
  if (outlineReview < 1) throw new Error(`expected outline review >= 1, got ${outlineReview}`)
}

async function main(): Promise<void> {
  const db = new PGlite()
  await createNovelSupportTables(db)

  await seedDefaultSkills(db, NOVEL_ID, '玄幻')
  console.log('full seed ok')
  await assertSeed(db)

  await db.query(`DELETE FROM novel_skills WHERE novel_id = $1`, [NOVEL_ID])
  await db.query(
    `INSERT INTO novel_skills (id, novel_id, title, section, agent_kind, skill_type, content, category)
     VALUES ($1, $2, '概述写作技能', 'overview', 'write', 'skill', 'stub', '玄幻')`,
    [randomUUID(), NOVEL_ID],
  )

  await backfillMissingSkills(db, NOVEL_ID, '玄幻')
  console.log('backfill ok')
  await assertSeed(db)

  const total = await countWhere(
    db,
    `SELECT COUNT(*)::int AS c FROM novel_skills WHERE novel_id = $1`,
    [NOVEL_ID],
  )
  console.log('total after backfill:', total)
  if (total < 6) throw new Error(`expected total >= 6 after backfill, got ${total}`)

  console.log('skill seed verification passed')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
