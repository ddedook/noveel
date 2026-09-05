import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { ChevronRight, FolderClosed, FolderPlus, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { AlertDialog, Button } from '@heroui/react'
import { cn } from '@/app/lib/utils'

type Novel = Awaited<ReturnType<typeof window.ipcApi.novel.list>>[number]
type Session = Awaited<ReturnType<typeof window.ipcApi.novelSession.list>>[number]

type SidebarNovelTreeProps = {
  novels: Novel[]
  loading: boolean
  expandedNovelIds: Set<string>
  currentSessionId: string | null
  onToggleExpand: (novelId: string) => void
  onSelectNovel: (novel: Novel) => void
  onSelectSession: (session: Session) => void
  onDeleteSession: (sessionId: string, novelId: string) => void
  onDeleteNovel: (novelId: string) => void
  onCreateNovel: () => void
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${String(minutes)} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${String(hours)} 小时`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${String(days)} 天`
  return `${String(Math.floor(days / 30))} 个月`
}

export function SidebarNovelTree({
  novels,
  loading,
  expandedNovelIds,
  currentSessionId,
  onToggleExpand,
  onSelectNovel,
  onSelectSession,
  onDeleteSession,
  onDeleteNovel,
  onCreateNovel,
}: SidebarNovelTreeProps) {
  const [pendingDeleteNovel, setPendingDeleteNovel] = useState<Novel | null>(null)
  const expandedIds = useMemo(() => [...expandedNovelIds], [expandedNovelIds])

  const sessionQueries = useQueries({
    queries: expandedIds.map((novelId) => ({
      queryKey: ['sessions', novelId],
      queryFn: () => window.ipcApi.novelSession.list({ novelId }),
      staleTime: 30_000,
    })),
  })

  const sessionsByNovel = useMemo(() => {
    const map = new Map<string, Session[]>()
    expandedIds.forEach((novelId, index) => {
      map.set(novelId, sessionQueries[index]?.data ?? [])
    })
    return map
  }, [expandedIds, sessionQueries])

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-black/5 dark:bg-white/5" />
        ))}
      </div>
    )
  }

  if (novels.length === 0) {
    return (
      <div className="noveel-sidebar-empty-novel">
        <button
          type="button"
          className="noveel-sidebar-new-session noveel-sidebar-create-novel-empty"
          onClick={onCreateNovel}
          aria-label="新建小说"
        >
          <Plus className="size-4 shrink-0" strokeWidth={1.5} />
          <span>小说</span>
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-0.5 pb-2">
        <div className="mb-1 flex items-center justify-between px-2">
          <span className="noveel-sidebar-section-label">小说</span>
          <button
            type="button"
            className="rounded-md p-1 text-muted transition-[transform,background-color] hover:bg-default active:scale-[0.96]"
            aria-label="新小说"
            onClick={onCreateNovel}
          >
            <FolderPlus className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>

        {novels.map((novel) => {
          const expanded = expandedNovelIds.has(novel.id)
          const sessions = sessionsByNovel.get(novel.id) ?? []

          return (
            <div key={novel.id}>
              <div className="group/novel relative flex min-w-0 items-center pr-1">
                <button
                  type="button"
                  className="noveel-sidebar-chevron"
                  aria-expanded={expanded}
                  aria-label={expanded ? '折叠' : '展开'}
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand(novel.id)
                  }}
                >
                  <ChevronRight
                    className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
                    strokeWidth={1.5}
                  />
                </button>
                <button
                  type="button"
                  className="noveel-sidebar-novel-row min-w-0 flex-1"
                  onClick={() => onSelectNovel(novel)}
                >
                  <FolderClosed className="size-4 shrink-0" strokeWidth={1.5} />
                  <span className="truncate">{novel.title}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  size="sm"
                  className="noveel-sidebar-novel-delete"
                  aria-label="删除小说"
                  onPress={() => setPendingDeleteNovel(novel)}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </Button>
              </div>

              {expanded ? (
                <div className="noveel-sidebar-tree-children">
                  {sessions.length === 0 ? (
                    <p className="noveel-sidebar-tree-empty">暂无聊天</p>
                  ) : (
                    sessions.map((session) => (
                      <div key={session.id} className="group/session relative">
                        <button
                          type="button"
                          className={cn(
                            'noveel-sidebar-session-row w-full',
                            currentSessionId === session.id && 'is-active',
                          )}
                          onClick={() => onSelectSession(session)}
                        >
                          <MessageSquare className="mr-1.5 size-3 shrink-0 opacity-60" strokeWidth={1.5} />
                          <span className="min-w-0 truncate">{session.title}</span>
                          <span className="noveel-sidebar-session-time ml-auto shrink-0 pl-2 text-[10px] text-muted">
                            {formatRelativeTime(session.updatedAt)}
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          isIconOnly
                          size="sm"
                          className="noveel-sidebar-session-delete"
                          aria-label="删除会话"
                          onPress={() => onDeleteSession(session.id, novel.id)}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={pendingDeleteNovel !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDeleteNovel(null)
          }}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <AlertDialog.Header>
                <AlertDialog.Heading>删除小说</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                将删除小说「{pendingDeleteNovel?.title ?? ''}」及其工作目录内全部数据，此操作不可恢复。
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="outline" onPress={() => setPendingDeleteNovel(null)}>
                  取消
                </Button>
                <Button
                  variant="danger"
                  onPress={() => {
                    if (pendingDeleteNovel) {
                      onDeleteNovel(pendingDeleteNovel.id)
                      setPendingDeleteNovel(null)
                    }
                  }}
                >
                  删除
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  )
}
