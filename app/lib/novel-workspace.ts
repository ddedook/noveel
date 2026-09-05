import type { NovelWorkspacePage } from '@/app/lib/app-store'
import { NOVEL_FEATURE_TABS } from '@/app/lib/app-store'

const NOVEL_PATH_RE = /^\/novel\/([a-z0-9]{8})(?:\/(.*))?$/

export function parseNovelRoute(pathname: string): {
  novelId: string | null
  page: NovelWorkspacePage
} {
  const match = pathname.match(NOVEL_PATH_RE)
  if (!match) return { novelId: null, page: 'overview' }
  const novelId = match[1] ?? null
  const segment = match[2]?.split('/')[0] ?? 'overview'
  const tab = NOVEL_FEATURE_TABS.find((t) => t.path === segment)
  return { novelId, page: tab?.key ?? 'overview' }
}

export function novelPagePath(page: NovelWorkspacePage): string {
  return NOVEL_FEATURE_TABS.find((t) => t.key === page)?.path ?? 'overview'
}

export const WORKSPACE_NAV_ITEMS = NOVEL_FEATURE_TABS.map((tab) => ({
  key: tab.key,
  label: tab.label,
  path: tab.path,
}))
