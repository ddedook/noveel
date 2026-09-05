import { getRegistryDb } from '@/lib/main/db/registry-access'

export type WritingStyleDto = {
  id: string
  slug: string
  name: string
  summary: string
  origin: string
}

export async function listWritingStyles(): Promise<WritingStyleDto[]> {
  const db = getRegistryDb()
  const { rows } = await db.query(`SELECT id, slug, name, summary, origin FROM writing_styles ORDER BY name`)
  return rows.map((row) => {
    const r = row as Record<string, unknown>
    return {
      id: String(r.id),
      slug: String(r.slug),
      name: String(r.name),
      summary: String(r.summary ?? ''),
      origin: String(r.origin ?? 'builtin'),
    }
  })
}
