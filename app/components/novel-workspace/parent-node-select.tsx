'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button, Label, Popover } from '@heroui/react'
import { cn } from '@/app/lib/utils'
import { itemKey, itemLabel, type ParentRefItem } from '@/app/lib/parent-ref'
import {
  WorkspaceFileTree,
  buildHierarchyTree,
} from '@/app/components/novel-workspace/workspace-file-tree'

export type ParentNodeOption = { value: string; label: string }

export function ParentNodeSelect(props: {
  value: string | null
  onChange: (value: string | null) => void
  items: ParentRefItem[]
  excludeIds?: Set<string>
  getLabel?: (item: ParentRefItem) => ReactNode
  sortSiblings?: (a: ParentRefItem, b: ParentRefItem) => number
  label?: string
  rootLabel?: string
  placeholder?: string
  disabled?: boolean
  id?: string
  className?: string
}) {
  const {
    value,
    onChange,
    items,
    excludeIds,
    getLabel,
    sortSiblings,
    label = '父节点',
    rootLabel = '无（根节点）',
    placeholder = '选择父节点',
    disabled,
    id = 'parent-node',
    className,
  } = props

  const [open, setOpen] = useState(false)

  const selectableItems = useMemo(
    () => items.filter((item) => !excludeIds?.has(itemKey(item))),
    [items, excludeIds],
  )

  const treeNodes = useMemo(
    () =>
      buildHierarchyTree(selectableItems, (item) => getLabel?.(item) ?? itemLabel(item), {
        sortSiblings,
      }),
    [selectableItems, getLabel, sortSiblings],
  )

  const displayLabel = useMemo(() => {
    if (!value) return rootLabel
    const hit = items.find((item) => itemKey(item) === value)
    if (!hit) return placeholder
    return getLabel?.(hit) ?? itemLabel(hit)
  }, [value, items, getLabel, rootLabel, placeholder])

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Popover isOpen={open} onOpenChange={setOpen}>
        <Popover.Trigger>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-expanded={open}
            isDisabled={disabled}
            className={cn('h-auto w-full justify-between font-normal', !value && 'text-muted')}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </Popover.Trigger>
        <Popover.Content className="w-[var(--trigger-width)] p-0">
          <Popover.Dialog>
            <div className="max-h-64 overflow-auto p-2">
              <button
                type="button"
                className={cn(
                  'mb-1 flex w-full items-center rounded-md px-2 py-1.5 text-sm hover:bg-default/60',
                  value == null && 'bg-accent-soft text-accent-soft-foreground',
                )}
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                {rootLabel}
              </button>
              <WorkspaceFileTree
                nodes={treeNodes}
                selectedKey={value}
                onSelect={(key) => {
                  onChange(key)
                  setOpen(false)
                }}
                emptyText="无可选父节点"
              />
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  )
}
