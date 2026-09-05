import type { PGlite } from '@electric-sql/pglite'

let registryDb: PGlite | null = null

export function setRegistryDb(db: PGlite): void {
  registryDb = db
}

export function getRegistryDb(): PGlite {
  if (!registryDb) throw new Error('Registry database not initialized')
  return registryDb
}
