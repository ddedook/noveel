import { mkdir, rm } from 'node:fs/promises'
import type { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getRegistryDb } from '@/lib/main/db/registry-access'
import { getNovelDb, closeNovelDb, setUserDataRoot } from '@/lib/main/db/novel-db-pool'
import { generateNovelId, assertNovelId } from '@/lib/main/novel/novel-context'
import {
  createNovelEntityTables,
  createNovelEntityUniqueIndexes,
  createNovelSupportTables,
  dropNovelEntityTables,
  ensureNovelBlueprintRow,
} from './data/entity-ddl'
import { seedDefaultSkills } from '@/lib/main/novel/skill-seed'
import {
  NOVEL_DB_DIR,
  NOVEL_FILES_DIR,
  assertEmptyWorkspace,
  assertWorkspaceDirectory,
  writeNovelManifest,
} from '@/lib/main/novel/novel-manifest'

export type ProvisionNovelInput = {
  title: string
  workspacePath: string
}

export type ProvisionNovelResult = {
  id: string
  title: string
  category: string
}

async function loadDefaultTemplate(category: string): Promise<Record<string, unknown>> {
  const templatesDir = join(process.cwd(), 'templates')
  for (const file of [`${category}.json`, '玄幻.json']) {
    try {
      const raw = await readFile(join(templatesDir, file), 'utf8')
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }
  }
  return {}
}

async function dropProvisionedNovel(id: string, workspacePath: string): Promise<void> {
  const registry = getRegistryDb()
  await registry.query(`DELETE FROM novels WHERE id = $1`, [id]).catch(() => undefined)
  await closeNovelDb(id).catch(() => undefined)
  try {
    const db = await getNovelDb(id)
    await dropNovelEntityTables(db)
  } catch {
    // novel db may not exist yet
  }
  await rm(workspacePath, { recursive: true, force: true }).catch(() => undefined)
}

export async function provisionNovel(
  userData: string,
  input: ProvisionNovelInput,
): Promise<ProvisionNovelResult> {
  setUserDataRoot(userData)
  const title = input.title.trim()
  if (!title) throw new Error('书名不能为空')

  const workspacePath = input.workspacePath.trim()
  if (!workspacePath) throw new Error('请选择工作目录')

  await assertWorkspaceDirectory(workspacePath)
  await assertEmptyWorkspace(workspacePath)

  const category = '玄幻'

  let id = ''
  const registry = getRegistryDb()
  for (let i = 0; i < 48; i++) {
    const candidate = generateNovelId()
    const { rows } = await registry.query(`SELECT COUNT(*)::int AS c FROM novels WHERE id = $1`, [candidate])
    if (((rows[0] as { c?: number })?.c ?? 0) === 0) {
      id = candidate
      break
    }
  }
  if (!id) throw new Error('无法生成唯一图书 ID')

  const dbPath = join(workspacePath, NOVEL_DB_DIR)
  await mkdir(join(workspacePath, NOVEL_FILES_DIR), { recursive: true })
  await writeNovelManifest(workspacePath, { id, title })

  await registry.query(
    `INSERT INTO novels (id, title, description, cover, category, writing_style_id, db_path, workspace_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, title, '', '', category, null, dbPath, workspacePath],
  )

  let novelDb: PGlite
  try {
    novelDb = await getNovelDb(id)
    await createNovelSupportTables(novelDb)
    await createNovelEntityTables(novelDb, id)
    await createNovelEntityUniqueIndexes(novelDb, id)
    await ensureNovelBlueprintRow(novelDb, id)

    const template = await loadDefaultTemplate(category)
    await novelDb.query(`INSERT INTO form_templates (id, config) VALUES ($1, $2::jsonb)`, [
      `tpl-${id}`,
      JSON.stringify(template),
    ])
    await seedDefaultSkills(novelDb, id, category)
  } catch (e) {
    await dropProvisionedNovel(id, workspacePath)
    throw e
  }

  assertNovelId(id)
  return { id, title, category }
}
