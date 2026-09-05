import { rm } from 'node:fs/promises'
import { getRegistryDb } from '@/lib/main/db/registry-access'
import { closeNovelDb } from '@/lib/main/db/novel-db-pool'
import { assertNovelId } from '@/lib/main/novel/novel-context'
import { provisionNovel, type ProvisionNovelInput } from '@/lib/main/novel/novel-provision'

export type NovelDto = {
  id: string
  title: string
  description: string
  cover: string
  category: string
  writingStyleId: string | null
  dbPath: string
  workspacePath: string
  chapterCount: number
  wordCount: number
  createdAt: string
  updatedAt: string
}

export type CreateNovelInput = ProvisionNovelInput
export type UpdateNovelInput = {
  id: string
  title?: string
  description?: string
  cover?: string
  category?: string
  writingStyleId?: string | null
}

function rowToDto(row: Record<string, unknown>): NovelDto {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description ?? ''),
    cover: String(row.cover ?? ''),
    category: String(row.category ?? '玄幻'),
    writingStyleId: row.writing_style_id ? String(row.writing_style_id) : null,
    dbPath: String(row.db_path),
    workspacePath: String(row.workspace_path ?? ''),
    chapterCount: Number(row.chapter_count ?? 0),
    wordCount: Number(row.word_count ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listNovels(): Promise<NovelDto[]> {
  const db = getRegistryDb()
  const { rows } = await db.query(
    `SELECT * FROM novels WHERE workspace_path IS NOT NULL AND workspace_path != '' ORDER BY updated_at DESC`,
  )
  return rows.map((r) => rowToDto(r as Record<string, unknown>))
}

export async function getNovel(id: string): Promise<NovelDto | null> {
  assertNovelId(id)
  const db = getRegistryDb()
  const { rows } = await db.query(`SELECT * FROM novels WHERE id = $1`, [id])
  if (!rows[0]) return null
  return rowToDto(rows[0] as Record<string, unknown>)
}

export async function getNovelDbPath(id: string): Promise<string> {
  assertNovelId(id)
  const novel = await getNovel(id)
  if (!novel?.dbPath) throw new Error(`Novel database path not found: ${id}`)
  return novel.dbPath
}

export async function createNovel(userData: string, input: CreateNovelInput): Promise<NovelDto> {
  const result = await provisionNovel(userData, input)
  const created = await getNovel(result.id)
  if (!created) throw new Error('Failed to create novel')
  return created
}

export async function updateNovel(input: UpdateNovelInput): Promise<NovelDto> {
  assertNovelId(input.id)
  const existing = await getNovel(input.id)
  if (!existing) throw new Error('Novel not found')

  const registry = getRegistryDb()
  await registry.query(
    `UPDATE novels SET
      title = COALESCE($2, title),
      description = COALESCE($3, description),
      cover = COALESCE($4, cover),
      category = COALESCE($5, category),
      writing_style_id = COALESCE($6, writing_style_id),
      updated_at = NOW()
     WHERE id = $1`,
    [
      input.id,
      input.title ?? null,
      input.description ?? null,
      input.cover ?? null,
      input.category ?? null,
      input.writingStyleId === undefined ? null : input.writingStyleId,
    ],
  )

  const updated = await getNovel(input.id)
  if (!updated) throw new Error('Novel not found after update')
  return updated
}

export async function deleteNovel(_userData: string, id: string): Promise<void> {
  assertNovelId(id)
  const novel = await getNovel(id)
  if (!novel) throw new Error('Novel not found')

  const registry = getRegistryDb()
  await registry.query(`DELETE FROM novels WHERE id = $1`, [id])
  await closeNovelDb(id)

  if (novel.workspacePath) {
    await rm(novel.workspacePath, { recursive: true, force: true })
  }
}
