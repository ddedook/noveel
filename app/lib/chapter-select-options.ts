import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'

export async function buildChapterSelectOptions(novelId: string): Promise<
  Array<{ label: string; value: string }>
> {
  const chapters = await window.ipcApi.entity.query({
    novelId,
    domain: 'chapter',
    depth: 'index',
  })
  return chapters
    .map((row) => {
      const id = String(row.id ?? '')
      const no = row.chapterNo != null ? String(row.chapterNo) : ''
      const title = row.title != null ? String(row.title) : ''
      const label = no && title ? `第${no}章 ${title}` : title || id
      return { label, value: id }
    })
    .filter((o) => o.value)
}

export type { FormFieldDef }
