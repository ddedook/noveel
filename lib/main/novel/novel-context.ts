export const NOVEL_ID_RE = /^[a-z0-9]{8}$/

export function assertNovelId(id: string): void {
  if (!NOVEL_ID_RE.test(id)) {
    throw new Error(`Invalid novel id: ${id}`)
  }
}

export function generateNovelId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id
}

export type NovelWorkspacePage =
  | 'basic'
  | 'overview'
  | 'world'
  | 'role'
  | 'creature'
  | 'item'
  | 'level'
  | 'timeline'
  | 'outline'
  | 'chapters'
  | 'template'
  | 'skills'

export type NovelContext = {
  novelId: string | null
  page: NovelWorkspacePage | null
}

let currentContext: NovelContext = { novelId: null, page: null }

export function getNovelContext(): NovelContext {
  return currentContext
}

export function setNovelContext(ctx: Partial<NovelContext>): NovelContext {
  currentContext = { ...currentContext, ...ctx }
  return currentContext
}
