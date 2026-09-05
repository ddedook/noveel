import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { DynamicTemplateFields } from '@/app/components/novel-workspace/dynamic-template-fields'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { EntityTree, type EntityTreeNode } from '@/app/components/novel-workspace/entity-tree'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import type { NovelWorkspacePage } from '@/app/lib/app-store'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'
import { getByPath } from '@/app/lib/form-path'

type EntityManagePageProps = {
  page: NovelWorkspacePage
  title: string
  domain: string
  nameField?: string
  templateFields?: FormFieldDef[]
  jsonKey?: string
  singleton?: boolean
  subtitle?: string
  saveFlat?: boolean
}

function itemLabel(item: Record<string, unknown>, nameField: string): string {
  return String(item[nameField] ?? item.title ?? item.name ?? item.id ?? '未命名')
}

export function EntityManagePage({
  page,
  title,
  domain,
  nameField = 'name',
  templateFields = [],
  jsonKey = 'detail',
  singleton,
  subtitle,
  saveFlat,
}: EntityManagePageProps) {
  const { novelId } = useNovelRouteContext(page)
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')
  const [draft, setDraft] = useState<Record<string, unknown>>({})

  const listQuery = useQuery({
    queryKey: ['entity', novelId, domain],
    queryFn: () => window.ipcApi.entity.query({ novelId: novelId!, domain, depth: 'full' }),
    enabled: Boolean(novelId),
  })

  const items = listQuery.data ?? []

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => itemLabel(item, nameField).toLowerCase().includes(q))
  }, [items, filterText, nameField])

  const treeNodes: EntityTreeNode[] = useMemo(
    () =>
      filtered.map((item) => ({
        key: String(item.id ?? 'singleton'),
        label: itemLabel(item, nameField),
      })),
    [filtered, nameField],
  )

  const selectedItem = useMemo(() => {
    if (singleton) return items[0] ?? null
    if (!selectedId) return null
    return items.find((item) => String(item.id) === selectedId) ?? null
  }, [items, selectedId, singleton])

  useEffect(() => {
    if (!selectedItem) {
      setDraft({})
      return
    }
    const jsonData =
      templateFields.length > 0
        ? saveFlat || jsonKey === 'content'
          ? selectedItem
          : ((getByPath(selectedItem, jsonKey) as Record<string, unknown> | undefined) ?? {})
        : selectedItem
    setDraft(
      typeof jsonData === 'object' && jsonData != null && !Array.isArray(jsonData)
        ? { ...jsonData }
        : {},
    )
  }, [selectedItem, jsonKey, templateFields.length, saveFlat])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'create', data }],
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['entity', novelId, domain] }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [
          {
            domain,
            action: singleton ? 'update' : 'update',
            id: selectedItem?.id ? String(selectedItem.id) : undefined,
            data,
          },
        ],
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['entity', novelId, domain] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'delete', id }],
      }),
    onSuccess: () => {
      setSelectedId(null)
      void queryClient.invalidateQueries({ queryKey: ['entity', novelId, domain] })
    },
  })

  if (!novelId) return null

  function handleAdd() {
    const name = `新${title}`
    createMutation.mutate({ [nameField]: name, title: name, [jsonKey]: {} })
  }

  function handleSave() {
    const payload = templateFields.length
      ? saveFlat || jsonKey === 'content'
        ? draft
        : { [jsonKey]: draft, ...(singleton ? { blueprint: draft } : {}) }
      : draft

    if (singleton) {
      updateMutation.mutate(payload)
      return
    }
    if (!selectedItem?.id) return
    updateMutation.mutate(payload)
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {subtitle ? <p className="text-muted mt-1 text-sm">{subtitle}</p> : null}
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {!singleton ? (
          <ManageTreeSidebar
            onAdd={handleAdd}
            showFilter
            filterText={filterText}
            onFilterTextChange={setFilterText}
            onClear={
              items.length
                ? () => {
                    for (const item of items) {
                      if (item.id) deleteMutation.mutate(String(item.id))
                    }
                  }
                : undefined
            }
          >
            <EntityTree
              nodes={treeNodes}
              selectedKey={selectedId}
              onSelect={setSelectedId}
            />
          </ManageTreeSidebar>
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selectedItem || singleton ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                {templateFields.length > 0 ? (
                  <DynamicTemplateFields fields={templateFields} value={draft} onChange={setDraft} />
                ) : (
                  <pre className="text-muted whitespace-pre-wrap text-xs">
                    {JSON.stringify(selectedItem ?? {}, null, 2)}
                  </pre>
                )}
              </div>
              <DetailSaveFooter onSave={handleSave} saving={updateMutation.isPending} />
            </>
          ) : (
            <div className="text-muted flex flex-1 items-center justify-center text-sm">
              选择左侧项目查看详情
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
