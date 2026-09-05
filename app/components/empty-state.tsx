import type { ReactNode } from 'react'
import { cn } from '@/app/lib/utils'

/** Minimal empty-state layout (HeroUI has no Empty primitive). */
export function EmptyState({
  className,
  icon,
  title,
  description,
  action,
}: {
  className?: string
  icon?: ReactNode
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        className,
      )}
    >
      {icon ? <div className="text-muted mb-1 [&_svg]:size-8">{icon}</div> : null}
      {title ? <div className="text-sm font-medium text-foreground">{title}</div> : null}
      {description ? <div className="text-muted max-w-sm text-sm">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
