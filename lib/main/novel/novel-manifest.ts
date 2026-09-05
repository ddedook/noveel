import { readdir, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const NOVEL_DB_DIR = 'pglite'
export const NOVEL_FILES_DIR = 'files'
export const NOVEL_MANIFEST_FILE = 'noveel.json'

export type NovelManifest = {
  id: string
  title: string
  version: 1
  createdAt: string
}

const IGNORED_EMPTY_DIR_ENTRIES = new Set(['.DS_Store'])

export async function assertEmptyWorkspace(dir: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    throw new Error('工作目录不存在或无法访问')
  }

  const significant = entries.filter((name) => !IGNORED_EMPTY_DIR_ENTRIES.has(name))
  if (significant.length > 0) {
    throw new Error('请选择空文件夹作为小说工作目录')
  }
}

export async function writeNovelManifest(
  workspacePath: string,
  manifest: Pick<NovelManifest, 'id' | 'title'>,
): Promise<void> {
  const payload: NovelManifest = {
    id: manifest.id,
    title: manifest.title,
    version: 1,
    createdAt: new Date().toISOString(),
  }
  await writeFile(
    join(workspacePath, NOVEL_MANIFEST_FILE),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  )
}

export async function assertWorkspaceDirectory(dir: string): Promise<void> {
  const info = await stat(dir).catch(() => null)
  if (!info?.isDirectory()) {
    throw new Error('工作目录必须是有效文件夹')
  }
}
