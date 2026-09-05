export type ChapterChangeOp = {
  entityKind: string
  entityId: string
  op: 'create' | 'update' | 'delete'
  before?: unknown
  label?: string
}

export type ChapterChangeBatchDto = {
  id: string
  novelId: string
  chapterId: string
  summary: string
  ops: ChapterChangeOp[]
  chapterBefore: Record<string, unknown> | null
  createdAt: string
  rolledBackAt: string | null
}

/** Stub until chapter change batch DDL is ported */
export async function listChapterChangeBatches(
  _novelId: string,
  _chapterId?: string,
): Promise<ChapterChangeBatchDto[]> {
  return []
}

export async function rollbackChapterChangeBatch(
  novelId: string,
  batchId: string,
): Promise<ChapterChangeBatchDto> {
  void novelId
  void batchId
  throw new Error('章节更新记录功能尚未启用')
}
