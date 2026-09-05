import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/app/lib/toast'
import { extractCreatedId, firstMutateError } from '@/app/lib/entity-mutate'

export function entityQueryKey(novelId: string, domain: string, filter?: Record<string, unknown>) {
  return ['entity', novelId, domain, filter ?? null] as const
}

export function useEntityList(
  novelId: string | undefined,
  domain: string,
  filter?: Record<string, unknown>,
) {
  return useQuery({
    queryKey: entityQueryKey(novelId ?? '', domain, filter),
    queryFn: () =>
      window.ipcApi.entity.query({
        novelId: novelId!,
        domain,
        filter,
        depth: 'full',
      }),
    enabled: Boolean(novelId),
  })
}

export function useEntityMutations(
  novelId: string | undefined,
  domain: string,
  options?: {
    filter?: Record<string, unknown>
    onCreated?: (id: string) => void
    invalidateDomains?: string[]
  },
) {
  const queryClient = useQueryClient()

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['entity', novelId] })
    for (const d of options?.invalidateDomains ?? []) {
      void queryClient.invalidateQueries({ queryKey: ['entity', novelId, d] })
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'create', data }],
      }),
    onSuccess: (report) => {
      if (!report.ok) {
        toast.error(firstMutateError(report) ?? '创建失败')
        return
      }
      invalidate()
      const id = extractCreatedId(report)
      if (id) options?.onCreated?.(id)
      toast.success('已创建')
    },
    onError: (e: Error) => toast.error(e.message || '创建失败'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'update', id, data }],
      }),
    onSuccess: (report) => {
      if (!report.ok) {
        toast.error(firstMutateError(report) ?? '保存失败')
        return
      }
      invalidate()
      toast.success('已保存')
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      window.ipcApi.entity.mutate({
        novelId: novelId!,
        ops: [{ domain, action: 'delete', id }],
      }),
    onSuccess: (report) => {
      if (!report.ok) {
        toast.error(firstMutateError(report) ?? '删除失败')
        return
      }
      invalidate()
      toast.success('已删除')
    },
    onError: (e: Error) => toast.error(e.message || '删除失败'),
  })

  return { createMutation, updateMutation, deleteMutation, invalidate }
}
