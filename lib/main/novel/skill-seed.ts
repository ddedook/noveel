import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { PGlite } from '@electric-sql/pglite'
import { noveelAppRoot } from '@/lib/main/dsh/app-root'

const SKIP_WRITE_DIRS = new Set(['genres', 'review', 'writing-style'])

const DIR_TO_SECTION = {
  overview: 'overview',
  role: 'role',
  creature: 'creature',
  level: 'level',
  world: 'world',
  timeline: 'timeline',
  outline: 'outline',
  chapter: 'chapters',
  item: 'item',
} as const

type SkillSection = (typeof DIR_TO_SECTION)[keyof typeof DIR_TO_SECTION]
type AgentKind = 'write' | 'review'

const SECTION_DEFAULT_TITLE: Record<SkillSection, string> = {
  overview: '概述写作技能',
  role: '人物写作技能',
  creature: '生物写作技能',
  level: '等级写作技能',
  world: '世界写作技能',
  timeline: '时间线写作技能',
  outline: '大纲写作技能',
  chapters: '章节写作技能',
  item: '物品写作技能',
}

const REVIEW_SECTION_DEFAULT_TITLE: Record<SkillSection, string> = {
  overview: '概述审查技能',
  role: '人物审查技能',
  creature: '生物审查技能',
  level: '等级审查技能',
  world: '世界审查技能',
  timeline: '时间线审查技能',
  outline: '大纲审查技能',
  chapters: '章节审查技能',
  item: '物品审查技能',
}

function skillsReferencesDir(): string {
  return join(noveelAppRoot(), 'references', 'skills')
}

function resolveTitle(
  fileBase: string,
  section: SkillSection,
  agentKind: AgentKind,
): string {
  if (fileBase === '默认') {
    const defaults = agentKind === 'review' ? REVIEW_SECTION_DEFAULT_TITLE : SECTION_DEFAULT_TITLE
    return defaults[section] ?? '默认'
  }
  return fileBase.trim()
}

async function skillExists(
  db: PGlite,
  novelId: string,
  section: SkillSection,
  agentKind: AgentKind,
  title: string,
): Promise<boolean> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM novel_skills
     WHERE novel_id = $1 AND section = $2 AND agent_kind = $3 AND title = $4`,
    [novelId, section, agentKind, title],
  )
  return (rows[0]?.c ?? 0) > 0
}

async function insertSkill(
  db: PGlite,
  novelId: string,
  category: string,
  section: SkillSection,
  agentKind: AgentKind,
  title: string,
  content: string,
  skipIfExists: boolean,
): Promise<boolean> {
  if (skipIfExists && (await skillExists(db, novelId, section, agentKind, title))) {
    return false
  }
  await db.query(
    `INSERT INTO novel_skills (id, novel_id, title, section, agent_kind, skill_type, content, category)
     VALUES ($1, $2, $3, $4, $5, 'skill', $6, $7)`,
    [randomUUID(), novelId, title, section, agentKind, content, category],
  )
  return true
}

async function seedMdFilesInSectionDir(
  db: PGlite,
  sectionPath: string,
  section: SkillSection,
  novelId: string,
  category: string,
  agentKind: AgentKind,
  skipIfExists: boolean,
): Promise<number> {
  if (!existsSync(sectionPath)) return 0

  let entries
  try {
    entries = await readdir(sectionPath, { withFileTypes: true })
  } catch {
    return 0
  }

  let inserted = 0
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const content = await readFile(join(sectionPath, entry.name), 'utf8')
    if (!content.trim()) continue
    const title = resolveTitle(entry.name.replace(/\.md$/, ''), section, agentKind)
    const ok = await insertSkill(db, novelId, category, section, agentKind, title, content, skipIfExists)
    if (ok) inserted++
  }
  return inserted
}

async function seedFromWriteRoot(
  db: PGlite,
  sectionRoot: string,
  novelId: string,
  category: string,
  skipIfExists: boolean,
): Promise<number> {
  if (!existsSync(sectionRoot)) return 0

  let entries
  try {
    entries = await readdir(sectionRoot, { withFileTypes: true })
  } catch {
    return 0
  }

  let inserted = 0
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (SKIP_WRITE_DIRS.has(entry.name)) continue
    const section = DIR_TO_SECTION[entry.name as keyof typeof DIR_TO_SECTION]
    if (!section) continue
    inserted += await seedMdFilesInSectionDir(
      db,
      join(sectionRoot, entry.name),
      section,
      novelId,
      category,
      'write',
      skipIfExists,
    )
  }
  return inserted
}

async function seedFromReviewRoot(
  db: PGlite,
  reviewRoot: string,
  novelId: string,
  category: string,
  skipIfExists: boolean,
): Promise<number> {
  if (!existsSync(reviewRoot)) return 0

  let entries
  try {
    entries = await readdir(reviewRoot, { withFileTypes: true })
  } catch {
    return 0
  }

  let inserted = 0
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const section = DIR_TO_SECTION[entry.name as keyof typeof DIR_TO_SECTION]
    if (!section) continue
    inserted += await seedMdFilesInSectionDir(
      db,
      join(reviewRoot, entry.name),
      section,
      novelId,
      category,
      'review',
      skipIfExists,
    )
  }
  return inserted
}

async function countSkills(db: PGlite, novelId: string): Promise<number> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM novel_skills WHERE novel_id = $1`,
    [novelId],
  )
  return rows[0]?.c ?? 0
}

async function countSkillsWhere(
  db: PGlite,
  novelId: string,
  section: SkillSection,
  agentKind: AgentKind,
): Promise<number> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM novel_skills
     WHERE novel_id = $1 AND section = $2 AND agent_kind = $3`,
    [novelId, section, agentKind],
  )
  return rows[0]?.c ?? 0
}

async function countReviewSkills(db: PGlite, novelId: string): Promise<number> {
  const { rows } = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM novel_skills WHERE novel_id = $1 AND agent_kind = 'review'`,
    [novelId],
  )
  return rows[0]?.c ?? 0
}

export async function seedNovelSkillsForNovel(
  db: PGlite,
  novelId: string,
  category: string,
): Promise<void> {
  const cat = category.trim() || '玄幻'
  const refDir = skillsReferencesDir()
  if (!existsSync(refDir)) return

  await seedFromWriteRoot(db, refDir, novelId, cat, false)
  await seedFromWriteRoot(db, join(refDir, 'genres', cat), novelId, cat, false)
  await seedFromReviewRoot(db, join(refDir, 'review'), novelId, cat, false)
  await seedFromReviewRoot(db, join(refDir, 'genres', cat, 'review'), novelId, cat, false)
}

/** Full seed used on novel provision and reset. */
export async function seedDefaultSkills(
  db: PGlite,
  novelId: string,
  category: string,
): Promise<void> {
  await seedNovelSkillsForNovel(db, novelId, category)
}

/** Idempotent backfill for books seeded with the broken logic. */
export async function backfillMissingSkills(
  db: PGlite,
  novelId: string,
  category: string,
): Promise<void> {
  const cat = category.trim() || '玄幻'
  const refDir = skillsReferencesDir()
  if (!existsSync(refDir)) return

  const skipIfExists = true

  if ((await countSkillsWhere(db, novelId, 'chapters', 'write')) === 0) {
    await seedMdFilesInSectionDir(
      db,
      join(refDir, 'chapter'),
      'chapters',
      novelId,
      cat,
      'write',
      skipIfExists,
    )
    const genreChapter = join(refDir, 'genres', cat, 'chapter')
    if (existsSync(genreChapter)) {
      await seedMdFilesInSectionDir(db, genreChapter, 'chapters', novelId, cat, 'write', skipIfExists)
    }
  }

  if ((await countReviewSkills(db, novelId)) === 0) {
    await seedFromReviewRoot(db, join(refDir, 'review'), novelId, cat, skipIfExists)
    await seedFromReviewRoot(db, join(refDir, 'genres', cat, 'review'), novelId, cat, skipIfExists)
  }

  // Repair any section still missing write skills from top-level dirs (e.g. misnamed paths).
  await seedFromWriteRoot(db, refDir, novelId, cat, skipIfExists)
  await seedFromWriteRoot(db, join(refDir, 'genres', cat), novelId, cat, skipIfExists)
}

export async function initOrBackfillSkills(
  db: PGlite,
  novelId: string,
  category: string,
): Promise<void> {
  const total = await countSkills(db, novelId)
  if (total === 0) {
    await seedNovelSkillsForNovel(db, novelId, category)
    return
  }
  await backfillMissingSkills(db, novelId, category)
}
