import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Input, TextField } from '@heroui/react'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import type { NovelWorkspacePage } from '@/app/lib/app-store'

type Props = {
  page: NovelWorkspacePage
  title: string
  domain: string
  nameField?: string
  singleton?: boolean
  renderItem?: (item: Record<string, unknown>) => ReactNode
}

export function EntityListPage({ page, title, domain, nameField = 'name', singleton, renderItem }: Props) {
  const { novelId } = useNovelRouteContext(page)
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')

  const listQuery = useQuery({
    queryKey: ['entity', novelId, domain],
    queryFn: () => window.ipcApi.entity.query({ novelId: novelId!, domain }),
    enabled: Boolean(novelId),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'create', data }],
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['entity', novelId, domain] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'delete', id }],
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['entity', novelId, domain] }),
  })

  if (!novelId) return null

  const items = listQuery.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        {!singleton ? (
          <div className="flex items-center gap-2">
            <TextField value={newName} onChange={setNewName} className="w-48">
              <Input placeholder={`新${title}名称`} />
            </TextField>
            <Button
              size="sm"
              onPress={() => {
                if (!newName.trim()) return
                createMutation.mutate({ [nameField]: newName.trim(), title: newName.trim() })
                setNewName('')
              }}
            >
              <Plus className="h-4 w-4" />
              新建
            </Button>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={String(item.id ?? 'singleton')} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">{String(item[nameField] ?? item.title ?? domain)}</div>
              {!singleton && item.id ? (
                <Button variant="ghost" isIconOnly onPress={() => deleteMutation.mutate(String(item.id))}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
            {renderItem ? (
              renderItem(item)
            ) : (
              <pre className="max-h-48 overflow-auto text-xs text-muted">
                {JSON.stringify(item, null, 2)}
              </pre>
            )}
          </div>
        ))}
        {items.length === 0 ? <div className="text-sm text-muted">暂无数据</div> : null}
      </div>
    </div>
  )
}
