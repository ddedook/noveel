import { getNovelDb } from '@/lib/main/db/novel-db-pool'
import { queryEntities } from '@/lib/main/novel/data/entity-repo'
import { getNovel } from '@/lib/main/novel/novel-service'
import { seedDefaultSkills, initOrBackfillSkills } from '@/lib/main/novel/skill-seed'

export async function initDefaultSkills(novelId: string) {
  const novel = await getNovel(novelId)
  if (!novel) throw new Error('小说不存在')
  const db = await getNovelDb(novelId)
  await initOrBackfillSkills(db, novelId, novel.category)
  return queryEntities(novelId, { domain: 'skill', depth: 'full' })
}

export async function resetDefaultSkills(novelId: string) {
  const novel = await getNovel(novelId)
  if (!novel) throw new Error('小说不存在')
  const db = await getNovelDb(novelId)
  await db.query(`DELETE FROM novel_skills WHERE novel_id = $1`, [novelId])
  await seedDefaultSkills(db, novelId, novel.category)
  return queryEntities(novelId, { domain: 'skill', depth: 'full' })
}
