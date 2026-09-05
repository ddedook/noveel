export type ChapterRow = Record<string, unknown> & {
  id?: string
  chapterNo?: number
  title?: string
  content?: string
}

export function countChapterWords(content: string | null | undefined): number {
  if (!content) return 0
  return content.replace(/\s/g, '').length
}

export function formatWordCount(count: number): string {
  if (count >= 10000) return `${(count / 10000).toFixed(count >= 100000 ? 0 : 1)}万字`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}千字`
  return `${count}字`
}

export function chapterListLabel(chapterNo: number | null | undefined, title: string | null | undefined): string {
  const no = chapterNo != null ? `第${chapterNo}章` : '章节'
  const t = String(title ?? '').trim()
  return t ? `${no} · ${t}` : no
}

export function buildChapterSelectOptions(chapters: ChapterRow[]): Array<{ label: string; value: string }> {
  return [...chapters]
    .sort((a, b) => Number(a.chapterNo ?? 0) - Number(b.chapterNo ?? 0))
    .map((ch) => ({
      label: chapterListLabel(Number(ch.chapterNo), String(ch.title ?? '')),
      value: String(ch.id),
    }))
}
