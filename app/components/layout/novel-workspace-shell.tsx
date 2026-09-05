import { PanelRightClose, PanelRightOpen } from 'lucide-react'
import { AppTopBar } from '@/app/components/layout/app-top-bar'
import { PanelToggleButton } from '@/app/components/layout/panel-toggle-button'
import { WorkspaceNav } from '@/app/components/layout/workspace-nav'
import { useLayoutStore } from '@/app/lib/layout-store'
import { useRouterState } from '@tanstack/react-router'
import { cn } from '@/app/lib/utils'

type NovelWorkspaceShellProps = {
  children: React.ReactNode
}

export function NovelWorkspaceShell({ children }: NovelWorkspaceShellProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const narrow = useLayoutStore((s) => s.narrow)
  const chat = useLayoutStore((s) => s.chat)
  const toggleChat = useLayoutStore((s) => s.toggleChat)

  const fullBleed = pathname.includes('/template') || pathname.includes('/skills')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppTopBar
        trailing={
          <PanelToggleButton
            expanded={chat > 0}
            side="right"
            onToggle={toggleChat}
            expandedIcon={PanelRightClose}
            collapsedIcon={PanelRightOpen}
            label={chat > 0 ? '隐藏对话' : '显示对话'}
          />
        }
      />

      <div className="flex min-h-0 flex-1">
        <WorkspaceNav narrow={narrow} />
        <div
          className={cn(
            'novel-workspace min-h-0 min-w-0 flex-1',
            fullBleed ? 'flex flex-col overflow-hidden p-0' : 'overflow-auto p-6',
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
