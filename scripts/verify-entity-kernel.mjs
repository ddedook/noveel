#!/usr/bin/env node
import { PGlite } from '@electric-sql/pglite'
import { createNovelSupportTables, createNovelEntityTables, createNovelEntityUniqueIndexes } from '../lib/main/novel/data/entity-ddl.ts'
import { mutateEntities, queryEntities } from '../lib/main/novel/data/entity-repo.ts'

const NOVEL_ID = 'testbk01'

async function main() {
  const db = new PGlite()
  await createNovelSupportTables(db)
  await createNovelEntityTables(db, NOVEL_ID)
  await createNovelEntityUniqueIndexes(db, NOVEL_ID)

  const role = await mutateEntities(NOVEL_ID, [
    { domain: 'role', action: 'create', data: { name: '林尘', profile: { identity: '散修' } } },
  ])
  console.log('role create:', role.ok)

  const roles = await queryEntities(NOVEL_ID, { domain: 'role' })
  console.log('roles:', roles.length)
  process.exit(role.ok && roles.length === 1 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
