import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { SidebarShell } from '@/app/components/layout/sidebar-shell'
import { SidebarNovelTree } from '@/app/components/layout/sidebar-novel-tree'
import { SidebarSettings } from '@/app/components/layout/sidebar-settings'
import { CreateNovelDialog } from '@/app/components/novel/create-novel-dialog'
import { useLayoutStore } from '@/app/lib/layout-store'
import { useAppStore } from '@/app/lib/app-store'
import { novelPagePath, parseNovelRoute } from '@/app/lib/novel-workspace'

type Novel = Awaited<ReturnType<typeof window.ipcApi.novel.list>>[number]
type Session = Awaited<ReturnType<typeof window.ipcApi.novelSession.list>>[number]

export function LeftSidebar() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [createOpen, setCreateOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [expandedNovelIds, setExpandedNovelIds] = useState<Set<string>>(() => new Set())

  const currentNovelId = useAppStore((s) => s.currentNovelId)
  const currentSessionId = useAppStore((s) => s.currentSessionId)
  const setCurrentNovelId = useAppStore((s) => s.setCurrentNovelId)
  const setCurrentSessionId = useAppStore((s) => s.setCurrentSessionId)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)
  const openChat = useLayoutStore((s) => s.openChat)

  const novelsQuery = useQuery({
    queryKey: ['novels'],
    queryFn: () => window.ipcApi.novel.list(),
  })

  const novels = novelsQuery.data ?? []
  const hasNovels = novels.length > 0
  const canCreateSession = hasNovels && currentNovelId !== null

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      if (!currentNovelId) throw new Error('请先选择小说')
      const session = await window.ipcApi.novelSession.create({
        novelId: currentNovelId,
        title: '新会话',
      })
      await window.ipcApi.dsh.sessionCreateAndBind({ novelSessionId: session.id })
      return session
    },
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', currentNovelId] })
      setExpandedNovelIds((prev) => new Set(prev).add(session.novelId))
      setCurrentSessionId(session.id)
      openChat()
      setToast(null)
    },
    onError: (error) => {
      setToast(error instanceof Error ? error.message : '创建会话失败')
    },
  })

  const deleteSessionMutation = useMutation({
    mutationFn: window.ipcApi.novelSession.delete,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (currentSessionId === variables.id) setCurrentSessionId(null)
    },
  })

  const deleteNovelMutation = useMutation({
    mutationFn: window.ipcApi.novel.delete,
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['novels'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      if (currentNovelId === variables.id) {
        setCurrentNovelId(null)
        setCurrentSessionId(null)
        setCurrentPage('overview')
        void window.ipcApi.novelContext.set({ novelId: null, page: null })
        void navigate({ to: '/' })
      }
    },
    onError: (error) => {
      setToast(error instanceof Error ? error.message : '删除小说失败')
    },
  })

  const ensureExpanded = useCallback((novelId: string) => {
    setExpandedNovelIds((prev) => {
      if (prev.has(novelId)) return prev
      const next = new Set(prev)
      next.add(novelId)
      return next
    })
  }, [])

  useEffect(() => {
    const novels = novelsQuery.data
    if (!novels?.length) return
    setExpandedNovelIds((prev) => {
      const next = new Set(prev)
      for (const novel of novels) next.add(novel.id)
      return next
    })
  }, [novelsQuery.data])

  useEffect(() => {
    if (currentNovelId) ensureExpanded(currentNovelId)
  }, [currentNovelId, ensureExpanded])

  function navigateToNovel(novelId: string, page = parseNovelRoute(pathname).page) {
    const path = novelPagePath(page)
    setCurrentNovelId(novelId)
    setCurrentPage(page)
    void window.ipcApi.novelContext.set({ novelId, page })
    void navigate({ to: `/novel/$id/${path}`, params: { id: novelId } })
  }

  async function selectNovel(novel: Novel) {
    ensureExpanded(novel.id)
    navigateToNovel(novel.id)

    const sessions = await queryClient.fetchQuery({
      queryKey: ['sessions', novel.id],
      queryFn: () => window.ipcApi.novelSession.list({ novelId: novel.id }),
      staleTime: 30_000,
    })

    if (sessions.length > 0) {
      const latest = [...sessions].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0]
      setCurrentSessionId(latest.id)
      openChat()
    } else {
      setCurrentSessionId(null)
    }
  }

  function selectSession(session: Session) {
    ensureExpanded(session.novelId)
    navigateToNovel(session.novelId)
    setCurrentSessionId(session.id)
    openChat()
  }

  function toggleExpand(novelId: string) {
    setExpandedNovelIds((prev) => {
      const next = new Set(prev)
      if (next.has(novelId)) next.delete(novelId)
      else next.add(novelId)
      return next
    })
  }

  function handleNewSession() {
    if (!canCreateSession) return
    createSessionMutation.mutate()
  }

  return (
    <>
      <SidebarShell
        onNewSession={handleNewSession}
        showNewSession={novelsQuery.isSuccess && hasNovels}
        newSessionDisabled={!canCreateSession || createSessionMutation.isPending}
        settingsSlot={<SidebarSettings />}
      >
        {toast ? (
          <div className="mx-1 mb-2 rounded-lg bg-danger/10 px-2 py-1 text-xs text-danger">
            {toast}
          </div>
        ) : null}
        <SidebarNovelTree
          novels={novels}
          loading={novelsQuery.isLoading}
          expandedNovelIds={expandedNovelIds}
          currentSessionId={currentSessionId}
          onToggleExpand={toggleExpand}
          onSelectNovel={selectNovel}
          onSelectSession={selectSession}
          onDeleteSession={(id, novelId) => {
            void queryClient.invalidateQueries({ queryKey: ['sessions', novelId] })
            deleteSessionMutation.mutate({ id })
          }}
          onDeleteNovel={(id) => deleteNovelMutation.mutate({ id })}
          onCreateNovel={() => setCreateOpen(true)}
        />
      </SidebarShell>
      <CreateNovelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  )
}
