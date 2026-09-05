import { randomUUID } from 'node:crypto'
import { getRegistryDb } from '@/lib/main/db/registry-access'

export type NovelSessionDto = {
  id: string
  novelId: string
  dshSessionId: string | null
  title: string
  createdAt: string
  updatedAt: string
}

function rowToDto(row: Record<string, unknown>): NovelSessionDto {
  return {
    id: String(row.id),
    novelId: String(row.novel_id),
    dshSessionId: row.dsh_session_id ? String(row.dsh_session_id) : null,
    title: String(row.title),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listNovelSessions(novelId: string): Promise<NovelSessionDto[]> {
  const db = getRegistryDb()
  const { rows } = await db.query(
    `SELECT * FROM novel_sessions WHERE novel_id = $1 ORDER BY updated_at DESC`,
    [novelId],
  )
  return rows.map((r) => rowToDto(r as Record<string, unknown>))
}

export async function createNovelSession(input: {
  novelId: string
  title?: string
}): Promise<NovelSessionDto> {
  const id = randomUUID()
  const title = input.title?.trim() || '新会话'
  const db = getRegistryDb()
  await db.query(
    `INSERT INTO novel_sessions (id, novel_id, title) VALUES ($1, $2, $3)`,
    [id, input.novelId, title],
  )
  const { rows } = await db.query(`SELECT * FROM novel_sessions WHERE id = $1`, [id])
  return rowToDto(rows[0] as Record<string, unknown>)
}

export async function renameNovelSession(input: {
  id: string
  title: string
}): Promise<NovelSessionDto> {
  const db = getRegistryDb()
  await db.query(
    `UPDATE novel_sessions SET title = $2, updated_at = NOW() WHERE id = $1`,
    [input.id, input.title.trim()],
  )
  const { rows } = await db.query(`SELECT * FROM novel_sessions WHERE id = $1`, [input.id])
  if (!rows[0]) throw new Error('Session not found')
  return rowToDto(rows[0] as Record<string, unknown>)
}

export async function deleteNovelSession(id: string): Promise<void> {
  const db = getRegistryDb()
  await db.query(`DELETE FROM novel_sessions WHERE id = $1`, [id])
}

export async function bindDshSession(id: string, dshSessionId: string): Promise<void> {
  const db = getRegistryDb()
  await db.query(
    `UPDATE novel_sessions SET dsh_session_id = $2, updated_at = NOW() WHERE id = $1`,
    [id, dshSessionId],
  )
}
