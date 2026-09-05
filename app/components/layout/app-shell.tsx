import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Outlet, useRouterState } from '@tanstack/react-router'
import { AppTopBar } from '@/app/components/layout/app-top-bar'
import { ChatPanelTrigger } from '@/app/components/layout/chat-panel-trigger'
import { AssistantChatPanel } from '@/app/components/layout/assistant-chat-panel'
import { NovelWorkspaceShell } from '@/app/components/layout/novel-workspace-shell'
import { LeftSidebar } from '@/app/components/layout/left-sidebar'
import { ResizeHandle } from '@/app/components/layout/resize-handle'
import {
  computeLayoutColumns,
  effectiveSidebarPreference,
  isSidebarCollapsed,
} from '@/app/lib/layout-state'
import { useLayoutStore } from '@/app/lib/layout-store'
import { useAppStore } from '@/app/lib/app-store'

export function AppShell() {
  const frameRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1400))
  const [dragging, setDragging] = useState(false)
  const columnsRef = useRef({ sidebar: 280, center: 760, chat: 360 })

  const setNarrow = useLayoutStore((s) => s.setNarrow)
  const setSidebar = useLayoutStore((s) => s.setSidebar)
  const setChat = useLayoutStore((s) => s.setChat)
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
  const toggleChat = useLayoutStore((s) => s.toggleChat)
  const currentNovelId = useAppStore((s) => s.currentNovelId)
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const inNovelWorkspace = /^\/novel\/[a-z0-9]{8}(?:\/|$)/.test(pathname)

  const subscribeLayout = useCallback(
    (listener: () => void) => useLayoutStore.subscribe(listener),
    [],
  )
  const readLayout = useCallback(() => useLayoutStore.getState(), [])
  const panels = useSyncExternalStore(subscribeLayout, readLayout, readLayout)

  useEffect(() => {
    const element = frameRef.current
    if (!element) return
    let raf: number | null = null
    const observer = new ResizeObserver(() => {
      raf ??= requestAnimationFrame(() => {
        raf = null
        const width = element.getBoundingClientRect().width
        if (width > 0) setViewport(width)
      })
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
      if (raf !== null) cancelAnimationFrame(raf)
    }
  }, [])

  useEffect(() => {
    setNarrow(viewport < 1024)
  }, [viewport, setNarrow])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === '\\') {
        event.preventDefault()
        if (event.shiftKey) toggleChat()
        else toggleSidebar()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleChat, toggleSidebar])

  const collapsed = isSidebarCollapsed(panels, panels.narrow)
  const sidebarPreference = effectiveSidebarPreference(panels, panels.narrow)
  const columns = computeLayoutColumns(viewport, sidebarPreference, panels.chat)
  columnsRef.current = columns
  const sidebarVisible = columns.sidebar > 0

  const sidebarBase = useRef(0)
  const chatBase = useRef(0)

  const onSidebarStart = useCallback(() => {
    sidebarBase.current = columnsRef.current.sidebar
    setDragging(true)
  }, [])
  const onChatStart = useCallback(() => {
    chatBase.current = columnsRef.current.chat
    setDragging(true)
  }, [])
  const onDragEnd = useCallback(() => setDragging(false), [])
  const onSidebarDrag = useCallback(
    (dx: number) => setSidebar(sidebarBase.current + dx),
    [setSidebar],
  )
  const onChatDrag = useCallback(
    (dx: number) => setChat(chatBase.current - dx),
    [setChat],
  )

  return (
    <div
      ref={frameRef}
      className="noveelShell relative grid h-full min-h-0"
      data-dragging={dragging || undefined}
      data-sidebar-collapsed={collapsed || undefined}
      data-chat-collapsed={columns.chat === 0 || undefined}
      style={{
        gridTemplateColumns: sidebarVisible
          ? `${columns.sidebar}px minmax(0, 1fr) ${columns.chat}px`
          : `minmax(0, 1fr) ${columns.chat}px`,
      }}
    >
      {sidebarVisible ? (
        <div className="noveel-sidebar-surface relative min-h-0">
          <LeftSidebar />
        </div>
      ) : null}

      <main className="flex min-h-0 min-w-0 flex-col bg-background">
        {inNovelWorkspace && currentNovelId ? (
          <NovelWorkspaceShell>
            <Outlet />
          </NovelWorkspaceShell>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <AppTopBar />
            <div className="min-h-0 flex-1 overflow-auto p-6">
              <Outlet />
            </div>
          </div>
        )}
      </main>

      <div
        className="noveel-chat-surface relative min-h-0"
        data-collapsed={columns.chat === 0 || undefined}
        aria-hidden={columns.chat === 0 || undefined}
      >
        <AssistantChatPanel collapsed={columns.chat === 0} />
      </div>

      {sidebarVisible ? (
        <ResizeHandle
          side="sidebar"
          left={columns.sidebar}
          onStart={onSidebarStart}
          onDrag={onSidebarDrag}
          onEnd={onDragEnd}
        />
      ) : null}
      {columns.chat > 0 ? (
        <ResizeHandle
          side="chat"
          left={viewport - columns.chat}
          onStart={onChatStart}
          onDrag={onChatDrag}
          onEnd={onDragEnd}
        />
      ) : null}

      <ChatPanelTrigger />
    </div>
  )
}
