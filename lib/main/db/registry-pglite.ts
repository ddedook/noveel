import { PGlite } from '@electric-sql/pglite'
import { join } from 'node:path'
import { setRegistryDb } from './registry-access'
import { ensureDbDirectory } from './ensure-db-directory'

const REGISTRY_DDL = `
CREATE TABLE IF NOT EXISTS novels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '玄幻',
  writing_style_id TEXT,
  db_path TEXT NOT NULL,
  workspace_path TEXT NOT NULL DEFAULT '',
  chapter_count INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS novel_sessions (
  id TEXT PRIMARY KEY,
  novel_id TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  dsh_session_id TEXT,
  title TEXT NOT NULL DEFAULT '新会话',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_novel_sessions_novel ON novel_sessions(novel_id);

CREATE TABLE IF NOT EXISTS writing_styles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  source_title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  origin TEXT NOT NULL DEFAULT 'builtin',
  status TEXT NOT NULL DEFAULT 'ready',
  pipeline_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`

const REGISTRY_MIGRATIONS = `
ALTER TABLE novels ADD COLUMN IF NOT EXISTS workspace_path TEXT NOT NULL DEFAULT '';
DELETE FROM novels WHERE workspace_path IS NULL OR workspace_path = '';
`

export async function initRegistryDb(dataDir: string): Promise<PGlite> {
  const dbPath = join(dataDir, 'registry', 'pglite')
  await ensureDbDirectory(dbPath)
  const db = new PGlite(dbPath)
  await db.exec(REGISTRY_DDL)
  await db.exec(REGISTRY_MIGRATIONS)
  setRegistryDb(db)
  return db
}

export function getRegistryDataDir(userData: string): string {
  return join(userData, 'registry', 'pglite')
}
