import type { LucideIcon } from 'lucide-react'
import { cn } from '@/app/lib/utils'

type PanelToggleButtonProps = {
  expanded: boolean
  side: 'left' | 'right'
  onToggle: () => void
  expandedIcon: LucideIcon
  collapsedIcon: LucideIcon
  label: string
  className?: string
}

export function PanelToggleButton({
  expanded,
  side,
  onToggle,
  expandedIcon: ExpandedIcon,
  collapsedIcon: CollapsedIcon,
  label,
  className,
}: PanelToggleButtonProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'relative inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-transform hover:bg-default hover:text-foreground active:scale-[0.96]',
        className,
      )}
      data-panel-side={side}
    >
      <ExpandedIcon
        className={cn(
          'absolute size-4 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          expanded ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]',
        )}
        strokeWidth={1.5}
      />
      <CollapsedIcon
        className={cn(
          'absolute size-4 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.2,0,0,1)]',
          expanded ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0',
        )}
        strokeWidth={1.5}
      />
    </button>
  )
}
