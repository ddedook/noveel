import { Link, useRouterState } from '@tanstack/react-router'
import {
  BookMarked,
  BookOpen,
  Box,
  Clock,
  FileText,
  Globe,
  Layers,
  ListOrdered,
  ScrollText,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { Tooltip } from '@heroui/react'
import { useAppStore } from '@/app/lib/app-store'
import { WORKSPACE_NAV_ITEMS, parseNovelRoute } from '@/app/lib/novel-workspace'
import { cn } from '@/app/lib/utils'

const ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  basic: FileText,
  overview: ScrollText,
  world: Globe,
  role: User,
  creature: Users,
  item: Box,
  level: Layers,
  timeline: Clock,
  outline: ListOrdered,
  chapters: BookOpen,
  template: BookMarked,
  skills: Sparkles,
}

type WorkspaceNavProps = {
  narrow?: boolean
}

export function WorkspaceNav({ narrow }: WorkspaceNavProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const currentNovelId = useAppStore((s) => s.currentNovelId)
  if (!currentNovelId) return null

  const activePage = parseNovelRoute(pathname).page

  return (
    <nav
      className={cn(
        'noveel-workspace-nav app-no-drag flex shrink-0 flex-col gap-1 py-3',
        narrow ? 'w-12 px-1' : 'w-[72px] px-2',
      )}
    >
      {WORKSPACE_NAV_ITEMS.map((tab) => {
        const Icon = ICONS[tab.key] ?? FileText
        const isActive = activePage === tab.key
        const link = (
          <Link
            key={tab.key}
            to={`/novel/$id/${tab.path}`}
            params={{ id: currentNovelId }}
            className={cn(
              'noveel-workspace-nav-item flex items-center justify-center rounded-lg transition-[background-color,transform,color] active:scale-[0.96]',
              narrow ? 'h-10 w-10' : 'h-11 w-full flex-col gap-0.5 py-1.5',
              isActive
                ? 'is-active font-medium'
                : 'text-muted hover:bg-default hover:text-foreground',
            )}
            onClick={() =>
              void window.ipcApi.novelContext.set({ novelId: currentNovelId, page: tab.key })
            }
          >
            <Icon className="size-4" strokeWidth={1.5} />
            {!narrow ? (
              <span className="max-w-full truncate text-[10px] leading-tight">{tab.label}</span>
            ) : null}
          </Link>
        )

        if (!narrow) return link

        return (
          <Tooltip key={tab.key} delay={500}>
            <Tooltip.Trigger>{link}</Tooltip.Trigger>
            <Tooltip.Content placement="right">{tab.label}</Tooltip.Content>
          </Tooltip>
        )
      })}
    </nav>
  )
}
