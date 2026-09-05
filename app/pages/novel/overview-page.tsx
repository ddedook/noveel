import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { AlertDialog, Button, Label } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { SingleCombobox } from '@/app/components/single-combobox'
import {
  DynamicTemplateFields,
  applyFieldDefaults,
} from '@/app/components/novel-workspace/dynamic-template-fields'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { useFormTemplateFields } from '@/app/hooks/use-form-template-fields'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { useEntityMutations } from '@/app/hooks/use-entity-crud'
import { NOVEL_FORM_MAX_WIDTH } from '@/app/lib/novel-form-layout'
import { firstMutateError } from '@/app/lib/entity-mutate'

export function NovelOverviewPage() {
  const { novelId, novel } = useNovelRouteContext('overview')
  const queryClient = useQueryClient()
  const { fields, isLoading: templateLoading } = useFormTemplateFields(novelId, 'overview')
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  const [writingStyleId, setWritingStyleId] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)

  const stylesQuery = useQuery({
    queryKey: ['writingStyles'],
    queryFn: () => window.ipcApi.writingStyle.list(),
  })

  const overviewQuery = useQuery({
    queryKey: ['entity', novelId, 'overview'],
    queryFn: () => window.ipcApi.entity.query({ novelId: novelId!, domain: 'overview', depth: 'full' }),
    enabled: Boolean(novelId),
  })

  useEffect(() => {
    if (novel) setWritingStyleId(novel.writingStyleId)
  }, [novel])

  useEffect(() => {
    const row = overviewQuery.data?.[0]
    const blueprint = (row?.blueprint as Record<string, unknown> | undefined) ?? {}
    setDraft(applyFieldDefaults(blueprint, fields))
  }, [overviewQuery.data, fields])

  const { updateMutation } = useEntityMutations(novelId, 'overview')

  const novelUpdateMutation = useMutation({
    mutationFn: window.ipcApi.novel.update,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['novel', novelId] }),
  })

  const clearMutation = useMutation({
    mutationFn: () => window.ipcApi.overview.clear({ novelId: novelId! }),
    onSuccess: () => {
      setDraft({})
      void queryClient.invalidateQueries({ queryKey: ['entity', novelId, 'overview'] })
      toast.success('已清空概述')
      setClearOpen(false)
    },
  })

  if (!novelId || templateLoading) {
    return <div className="text-sm text-muted">加载中…</div>
  }

  const readyStyles = stylesQuery.data ?? []

  function handleSave() {
    if (!novelId) return
    void (async () => {
      if (writingStyleId !== novel?.writingStyleId) {
        await novelUpdateMutation.mutateAsync({ id: novelId, writingStyleId })
      }
      const report = await window.ipcApi.entity.mutate({
        novelId,
        ops: [{ domain: 'overview', action: 'update', data: { blueprint: draft } }],
      })
      if (!report.ok) {
        toast.error(firstMutateError(report) ?? '保存失败')
        return
      }
      void queryClient.invalidateQueries({ queryKey: ['entity', novelId, 'overview'] })
      toast.success('已保存')
    })()
  }

  return (
    <div className={`flex flex-col gap-4 ${NOVEL_FORM_MAX_WIDTH}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">概述</h2>
          <p className="text-sm text-muted">小说核心蓝图，字段由表单模板驱动</p>
        </div>
        <Button type="button" variant="outline" size="sm" onPress={() => setClearOpen(true)}>
          清空
        </Button>
        <AlertDialog>
          <AlertDialog.Backdrop isOpen={clearOpen} onOpenChange={setClearOpen}>
            <AlertDialog.Container>
              <AlertDialog.Dialog className="app-no-drag">
                <AlertDialog.Header>
                  <AlertDialog.Heading>清空概述？</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p className="text-muted text-sm">将删除所有概述字段内容，不可撤销。</p>
                </AlertDialog.Body>
                <AlertDialog.Footer>
                  <AlertDialog.CloseTrigger>
                    <Button variant="outline">取消</Button>
                  </AlertDialog.CloseTrigger>
                  <Button variant="danger" onPress={() => clearMutation.mutate()}>
                    清空
                  </Button>
                </AlertDialog.Footer>
              </AlertDialog.Dialog>
            </AlertDialog.Container>
          </AlertDialog.Backdrop>
        </AlertDialog>
      </div>

      <div className="flex flex-col gap-3">
        <Label>写作风格</Label>
        <SingleCombobox
          className="max-w-sm"
          value={writingStyleId ?? '__none__'}
          placeholder="选择写作风格"
          onValueChange={(v) => setWritingStyleId(v === '__none__' ? null : v)}
          options={[
            { value: '__none__', label: '未绑定' },
            ...readyStyles.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
      </div>

      {fields.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted">
          模板尚未配置概述字段，请前往「模板」页添加。
        </p>
      ) : (
        <DynamicTemplateFields fields={fields} value={draft} onChange={setDraft} />
      )}

      <DetailSaveFooter
        onSave={handleSave}
        saving={updateMutation.isPending || novelUpdateMutation.isPending}
      />
    </div>
  )
}
