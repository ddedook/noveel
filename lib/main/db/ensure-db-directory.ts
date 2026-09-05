import { mkdir } from 'node:fs/promises'

export async function ensureDbDirectory(dbPath: string): Promise<void> {
  await mkdir(dbPath, { recursive: true })
}
