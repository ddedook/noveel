import type { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  Button,
  Tooltip,
} from '@heroui/react'
import { cn } from '@/app/lib/utils'

export type ManageTreeLabelProps = {
  title: ReactNode
  tooltipTitle?: string
  selected?: boolean
  onDelete?: () => void
  deleteConfirm?: string
  deleteTooltip?: string
  deleteLoading?: boolean
  onAddChild?: () => void
  addChildTooltip?: string
  className?: string
}

export function ManageTreeLabel({
  title,
  tooltipTitle,
  selected,
  onDelete,
  deleteConfirm = '确定删除？',
  deleteTooltip = '删除',
  deleteLoading,
  onAddChild,
  addChildTooltip = '添加子项',
  className,
}: ManageTreeLabelProps) {
  const showActions = Boolean(onDelete || onAddChild)
  const resolvedTooltip = tooltipTitle ?? (typeof title === 'string' ? title : undefined)
  const titleClassName = cn(
    'min-w-0 flex-1',
    typeof title === 'string' && 'truncate',
    selected && 'font-semibold',
  )

  const titleNode = resolvedTooltip ? (
    <Tooltip>
      <div className={titleClassName}>{title}</div>
      <Tooltip.Content>{resolvedTooltip}</Tooltip.Content>
    </Tooltip>
  ) : (
    <div className={titleClassName}>{title}</div>
  )

  return (
    <div
      className={cn('flex w-full min-w-0 items-center gap-0.5', className)}
      data-selected={selected ? 'true' : undefined}
    >
      {titleNode}
      {showActions ? (
        <div className="app-no-drag ml-auto flex shrink-0 items-center gap-0 opacity-0 transition-opacity duration-150 group-hover/tree-row:opacity-100 group-focus-within/tree-row:opacity-100">
          {onAddChild ? (
            <Tooltip>
              <Button
                type="button"
                variant="ghost"
                isIconOnly
                size="sm"
                className="active:scale-100 active:translate-y-0"
                aria-label={addChildTooltip}
                onPress={(e) => {
                  e.continuePropagation?.()
                  onAddChild()
                }}
              >
                <Plus strokeWidth={1.5} />
              </Button>
              <Tooltip.Content>{addChildTooltip}</Tooltip.Content>
            </Tooltip>
          ) : null}
          {onDelete ? (
            <AlertDialog>
              <Tooltip>
                <AlertDialog.Trigger>
                  <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    size="sm"
                    className="text-danger active:scale-100 active:translate-y-0"
                    aria-label={deleteTooltip}
                    isDisabled={deleteLoading}
                    onPress={(e) => e.continuePropagation?.()}
                  >
                    <Trash2 strokeWidth={1.5} />
                  </Button>
                </AlertDialog.Trigger>
                <Tooltip.Content>{deleteTooltip}</Tooltip.Content>
              </Tooltip>
              <AlertDialog.Backdrop onClick={(e) => e.stopPropagation()}>
                <AlertDialog.Container className="app-no-drag">
                  <AlertDialog.Dialog onClick={(e) => e.stopPropagation()}>
                    <AlertDialog.Header>
                      <AlertDialog.Heading>{deleteConfirm}</AlertDialog.Heading>
                    </AlertDialog.Header>
                    <AlertDialog.Body>
                      <p className="text-muted text-sm">此操作不可撤销。</p>
                    </AlertDialog.Body>
                    <AlertDialog.Footer>
                      <Button variant="outline" slot="close">
                        取消
                      </Button>
                      <Button
                        variant="danger"
                        onPress={(e) => {
                          e.continuePropagation?.()
                          onDelete()
                        }}
                      >
                        删除
                      </Button>
                    </AlertDialog.Footer>
                  </AlertDialog.Dialog>
                </AlertDialog.Container>
              </AlertDialog.Backdrop>
            </AlertDialog>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
