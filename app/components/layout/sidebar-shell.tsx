import { type ReactNode } from 'react'
import { MessageSquarePlus } from 'lucide-react'
import '@/app/styles/sidebar-shell.css'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)

type SidebarShellProps = {
  onNewSession: () => void
  showNewSession?: boolean
  newSessionDisabled?: boolean
  settingsSlot: ReactNode
  children: ReactNode
}

export function SidebarShell({
  onNewSession,
  showNewSession = true,
  newSessionDisabled,
  settingsSlot,
  children,
}: SidebarShellProps) {
  return (
    <aside className="noveel-sidebar-root noveel-sidebar-surface">
      {isMac ? <div className="noveel-sidebar-titlebar-spacer app-drag-region" aria-hidden /> : null}
      {showNewSession ? (
        <button
          type="button"
          className="noveel-sidebar-new-session"
          disabled={newSessionDisabled}
          onClick={onNewSession}
          aria-label="新会话"
        >
          <MessageSquarePlus className="size-4 shrink-0" strokeWidth={1.5} />
          <span>新会话</span>
        </button>
      ) : null}

      <div className="noveel-sidebar-region">
        <div className="noveel-sidebar-scroll">{children}</div>
        <div className="noveel-sidebar-scroll-fade" aria-hidden />
      </div>

      <div className="noveel-sidebar-foot">{settingsSlot}</div>
    </aside>
  )
}
