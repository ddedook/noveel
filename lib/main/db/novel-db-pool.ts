import type { PGlite } from '@electric-sql/pglite'
import { PGlite as PGliteCtor } from '@electric-sql/pglite'
import { assertNovelId } from '@/lib/main/novel/novel-context'
import { getRegistryDb } from './registry-access'
import { ensureDbDirectory } from './ensure-db-directory'

type PoolEntry = {
  db: PGlite
  lastUsed: number
}

const MAX_POOL = 3
const IDLE_MS = 5 * 60 * 1000
const pool = new Map<string, PoolEntry>()
let userDataRoot = ''

export function setUserDataRoot(path: string): void {
  userDataRoot = path
}

export function getUserDataRoot(): string {
  return userDataRoot
}

async function resolveNovelDbPath(novelId: string): Promise<string> {
  assertNovelId(novelId)
  const { rows } = await getRegistryDb().query(`SELECT db_path FROM novels WHERE id = $1`, [novelId])
  const dbPath = (rows[0] as { db_path?: string } | undefined)?.db_path
  if (!dbPath) throw new Error(`Novel database path not found: ${novelId}`)
  return dbPath
}

export async function getNovelDb(novelId: string): Promise<PGlite> {
  const existing = pool.get(novelId)
  if (existing) {
    existing.lastUsed = Date.now()
    return existing.db
  }

  while (pool.size >= MAX_POOL) {
    evictOldest()
  }

  const dbPath = await resolveNovelDbPath(novelId)
  await ensureDbDirectory(dbPath)
  const db = new PGliteCtor(dbPath)
  pool.set(novelId, { db, lastUsed: Date.now() })
  return db
}

export async function closeNovelDb(novelId: string): Promise<void> {
  const entry = pool.get(novelId)
  if (!entry) return
  await entry.db.close()
  pool.delete(novelId)
}

export async function closeAllNovelDbs(): Promise<void> {
  for (const [id, entry] of pool) {
    await entry.db.close()
    pool.delete(id)
  }
}

function evictOldest(): void {
  let oldestId: string | null = null
  let oldestTime = Infinity
  for (const [id, entry] of pool) {
    if (entry.lastUsed < oldestTime) {
      oldestTime = entry.lastUsed
      oldestId = id
    }
  }
  if (oldestId) {
    void closeNovelDb(oldestId)
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of pool) {
    if (now - entry.lastUsed > IDLE_MS) {
      void closeNovelDb(id)
    }
  }
}, 60_000)
