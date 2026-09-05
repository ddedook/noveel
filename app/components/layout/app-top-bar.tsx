import { type ReactNode } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { PanelToggleButton } from '@/app/components/layout/panel-toggle-button'
import { useLayoutStore } from '@/app/lib/layout-store'
import { cn } from '@/app/lib/utils'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)

type AppTopBarProps = {
  trailing?: ReactNode
  className?: string
}

export function AppTopBar({ trailing, className }: AppTopBarProps) {
  const sidebarCollapsed = useLayoutStore((s) =>
    s.narrow ? !s.narrowExpanded : s.sidebar === 0,
  )
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)

  return (
    <header
      className={cn(
        'flex shrink-0 items-center gap-3 border-b border-border pr-4',
        isMac ? 'noveel-mac-titlebar' : 'h-12',
        isMac && sidebarCollapsed ? 'noveel-mac-titlebar-inset-left' : 'pl-4',
        className,
      )}
    >
      <div className="app-no-drag flex shrink-0 items-center">
        <PanelToggleButton
          expanded={!sidebarCollapsed}
          side="left"
          onToggle={toggleSidebar}
          expandedIcon={PanelLeftClose}
          collapsedIcon={PanelLeftOpen}
          label={sidebarCollapsed ? '显示侧栏' : '隐藏侧栏'}
        />
      </div>
      <div
        className={cn(
          'app-drag-region min-w-0 flex-1 self-stretch',
          isMac ? 'noveel-mac-titlebar' : 'min-h-12',
        )}
      />
      {trailing ? <div className="app-no-drag flex shrink-0 items-center">{trailing}</div> : null}
    </header>
  )
}
