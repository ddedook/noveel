'use client'

import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import { Button, Disclosure } from '@heroui/react'
import { EmptyState } from '@/app/components/empty-state'
import { cn } from '@/app/lib/utils'
import { resolveParentId } from '@/app/lib/parent-ref'
import { ManageTreeLabel } from '@/app/components/novel-workspace/manage-tree-label'

export type WorkspaceTreeNode = {
  key: string
  label: ReactNode
  tooltip?: string
  selectable?: boolean
  children?: WorkspaceTreeNode[]
  onDelete?: () => void
  onAddChild?: () => void
  deleteLoading?: boolean
}

type WorkspaceFileTreeProps = {
  nodes: WorkspaceTreeNode[]
  selectedKey: string | null
  onSelect: (key: string) => void
  emptyText?: string
}

function defaultItemKey(item: { id?: unknown }): string {
  return String(item.id ?? '').trim()
}

function defaultSortSiblings<T extends { sortOrder?: unknown; name?: unknown }>(a: T, b: T): number {
  const ao = Number(a.sortOrder ?? 0)
  const bo = Number(b.sortOrder ?? 0)
  if (ao !== bo) return ao - bo
  return String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-CN')
}

function TreeItem({
  node,
  selectedKey,
  onSelect,
  expandedForDisplay,
  onToggleExpanded,
}: {
  node: WorkspaceTreeNode
  selectedKey: string | null
  onSelect: (key: string) => void
  expandedForDisplay: Set<string>
  onToggleExpanded: (key: string, open: boolean) => void
}) {
  const hasChildren = Boolean(node.children?.length)
  const expanded = expandedForDisplay.has(node.key)
  const selected = selectedKey === node.key
  const selectable = node.selectable !== false

  function toggleExpanded(open: boolean) {
    onToggleExpanded(node.key, open)
  }

  function handleSelect() {
    if (!selectable) {
      if (hasChildren) toggleExpanded(!expanded)
      return
    }
    onSelect(node.key)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleSelect()
    }
  }

  const row = (
    <div
      role="treeitem"
      aria-selected={selectable ? selected : undefined}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={selectable ? 0 : -1}
      className={cn(
        'group/tree-row flex w-full items-center gap-1 rounded-md py-1 pr-1 pl-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent',
        selectable && 'cursor-pointer hover:bg-default/60',
        selected && selectable && 'border-l-2 border-l-accent bg-accent-soft text-accent-soft-foreground',
      )}
      onClick={handleSelect}
      onKeyDown={onKeyDown}
    >
      {hasChildren ? (
        <Disclosure.Heading>
          <Button
            slot="trigger"
            type="button"
            variant="ghost"
            isIconOnly
            size="sm"
            className="size-5 shrink-0 active:scale-100"
            onPress={(e) => e.continuePropagation?.()}
          >
            <ChevronRight className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-90')} />
          </Button>
        </Disclosure.Heading>
      ) : (
        <span className="size-5 shrink-0" />
      )}
      {hasChildren ? (
        expanded ? (
          <FolderOpen className="size-3.5 shrink-0 text-muted" />
        ) : (
          <Folder className="size-3.5 shrink-0 text-muted" />
        )
      ) : (
        <File className="size-3.5 shrink-0 text-muted" />
      )}
      <ManageTreeLabel
        className="min-w-0 flex-1"
        title={node.label}
        tooltipTitle={node.tooltip}
        selected={selected}
        onDelete={node.onDelete}
        onAddChild={node.onAddChild}
        deleteLoading={node.deleteLoading}
      />
    </div>
  )

  if (!hasChildren) return row

  return (
    <Disclosure isExpanded={expanded} onExpandedChange={toggleExpanded}>
      {row}
      <Disclosure.Content>
        <div role="group" className="pl-4">
          {node.children!.map((child) => (
            <TreeItem
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              onSelect={onSelect}
              expandedForDisplay={expandedForDisplay}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      </Disclosure.Content>
    </Disclosure>
  )
}

export function WorkspaceFileTree({
  nodes,
  selectedKey,
  onSelect,
  emptyText = '暂无数据',
}: WorkspaceFileTreeProps) {
  const allExpandable = useMemo(() => {
    const keys = new Set<string>()
    function walk(list: WorkspaceTreeNode[]) {
      for (const n of list) {
        if (n.children?.length) {
          keys.add(n.key)
          walk(n.children)
        }
      }
    }
    walk(nodes)
    return keys
  }, [nodes])

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setExpandedKeys((prev) => {
      if (prev.size === 0) return new Set(allExpandable)
      const next = new Set(prev)
      for (const k of allExpandable) next.add(k)
      return next
    })
  }, [nodes, allExpandable])

  const effectiveExpanded = expandedKeys.size > 0 ? expandedKeys : allExpandable

  function handleToggleExpanded(key: string, open: boolean) {
    setExpandedKeys((prev) => {
      const base = prev.size > 0 ? prev : new Set(allExpandable)
      const next = new Set(base)
      if (open) next.add(key)
      else next.delete(key)
      return next
    })
  }

  if (nodes.length === 0) {
    return (
      <EmptyState
        className="p-4"
        icon={<Folder />}
        title={emptyText}
        description="点击 + 添加第一条记录"
      />
    )
  }

  return (
    <div role="tree" className="flex flex-col gap-0.5">
      {nodes.map((node) => (
        <TreeItem
          key={node.key}
          node={node}
          selectedKey={selectedKey}
          onSelect={onSelect}
          expandedForDisplay={effectiveExpanded}
          onToggleExpanded={handleToggleExpanded}
        />
      ))}
    </div>
  )
}

export function buildHierarchyTree<T extends { id?: unknown; parentId?: unknown; sortOrder?: unknown; name?: unknown }>(
  items: T[],
  getLabel: (item: T) => ReactNode,
  options?: {
    getKey?: (item: T) => string
    getTooltip?: (item: T) => string | undefined
    sortSiblings?: (a: T, b: T) => number
    onDelete?: (item: T) => void
    onAddChild?: (item: T) => void
    deleteLoadingId?: string | null
  },
): WorkspaceTreeNode[] {
  const getKey = options?.getKey ?? defaultItemKey
  const sortSiblings = options?.sortSiblings ?? defaultSortSiblings

  const allIds = new Set(items.map((item) => getKey(item)))
  const byParent = new Map<string | null, T[]>()

  for (const item of items) {
    let pid = resolveParentId(items, item.parentId)
    if (pid != null && !allIds.has(pid)) pid = null
    const list = byParent.get(pid) ?? []
    list.push(item)
    byParent.set(pid, list)
  }

  for (const [pid, list] of byParent.entries()) {
    list.sort(sortSiblings)
    byParent.set(pid, list)
  }

  function build(parentId: string | null): WorkspaceTreeNode[] {
    const list = byParent.get(parentId) ?? []
    return list.map((item) => {
      const key = getKey(item)
      const children = build(key)
      return {
        key,
        label: getLabel(item),
        tooltip: options?.getTooltip?.(item),
        selectable: true,
        children: children.length > 0 ? children : undefined,
        onDelete: options?.onDelete ? () => options.onDelete!(item) : undefined,
        onAddChild: options?.onAddChild ? () => options.onAddChild!(item) : undefined,
        deleteLoading: options?.deleteLoadingId === key,
      }
    })
  }

  return build(null)
}

export function buildFlatTree<T extends { id?: unknown }>(
  items: T[],
  getLabel: (item: T) => ReactNode,
  options?: {
    getKey?: (item: T) => string
    getTooltip?: (item: T) => string | undefined
    sort?: (a: T, b: T) => number
    onDelete?: (item: T) => void
    deleteLoadingId?: string | null
  },
): WorkspaceTreeNode[] {
  const getKey = options?.getKey ?? defaultItemKey
  const sorted = options?.sort ? [...items].sort(options.sort) : items

  return sorted.map((item) => {
    const key = getKey(item)
    return {
      key,
      label: getLabel(item),
      tooltip: options?.getTooltip?.(item),
      selectable: true,
      onDelete: options?.onDelete ? () => options.onDelete!(item) : undefined,
      deleteLoading: options?.deleteLoadingId === key,
    }
  })
}

/** @deprecated Use WorkspaceFileTree */
export const WorkspaceTree = WorkspaceFileTree
