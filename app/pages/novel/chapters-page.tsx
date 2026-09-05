import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { BookOpen, RotateCcw } from 'lucide-react'
import { Button, Chip, Input, Label, TextArea, TextField } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { WorkspaceTree, buildFlatTree } from '@/app/components/novel-workspace/workspace-tree'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { FormModal, FORM_MODAL_SECTION_CLASS } from '@/app/components/novel-workspace/form-modal'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { useEntityList, useEntityMutations } from '@/app/hooks/use-entity-crud'
import {
  chapterListLabel,
  countChapterWords,
  formatWordCount,
} from '@/app/lib/chapter-utils'

export function NovelChaptersPage() {
  const { novelId } = useNovelRouteContext('chapters')
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')

  const listQuery = useEntityList(novelId, 'chapter')
  const chapters = useMemo(() => {
    const rows = (listQuery.data ?? []) as Record<string, unknown>[]
    return [...rows].sort((a, b) => Number(a.chapterNo ?? 0) - Number(b.chapterNo ?? 0))
  }, [listQuery.data])

  const selectedChapter = useMemo(
    () => (selectedId ? chapters.find((c) => String(c.id) === selectedId) ?? null : null),
    [chapters, selectedId],
  )

  const batchQuery = useQuery({
    queryKey: ['chapterChangeBatch', novelId, selectedId],
    queryFn: () =>
      window.ipcApi.chapterChangeBatch.list({
        novelId: novelId!,
        chapterId: selectedId ?? undefined,
      }),
    enabled: Boolean(novelId && selectedId),
  })

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'chapter', {
    onCreated: (id) => {
      setSelectedId(id)
      setCreateOpen(false)
      setCreateTitle('')
    },
  })

  const rollbackMutation = useMutation({
    mutationFn: (batchId: string) =>
      window.ipcApi.chapterChangeBatch.rollback({ novelId: novelId!, batchId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['entity', novelId] })
      void queryClient.invalidateQueries({ queryKey: ['chapterChangeBatch', novelId, selectedId] })
      toast.success('已回滚到该记录状态')
    },
    onError: (e: Error) => toast.error(e.message || '回滚失败'),
  })

  const treeNodes = useMemo(
    () =>
      buildFlatTree(chapters, (ch) => (
        <span className="flex min-w-0 flex-col">
          <span className="line-clamp-2">
            {chapterListLabel(Number(ch.chapterNo), String(ch.title ?? ''))}
          </span>
          <span className="text-xs text-muted">
            {formatWordCount(countChapterWords(String(ch.content ?? '')))}
          </span>
        </span>
      ), {
        getTooltip: (ch) => chapterListLabel(Number(ch.chapterNo), String(ch.title ?? '')),
        onDelete: (ch) => {
          const id = String(ch.id)
          deleteMutation.mutate(id)
          if (selectedId === id) setSelectedId(null)
        },
        deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
      }),
    [chapters, deleteMutation, selectedId],
  )

  useEffect(() => {
    if (!selectedChapter) {
      setDraftTitle('')
      setDraftContent('')
      return
    }
    setDraftTitle(String(selectedChapter.title ?? ''))
    setDraftContent(String(selectedChapter.content ?? ''))
  }, [selectedChapter])

  useEffect(() => {
    if (selectedId && chapters.length > 0 && !chapters.some((c) => String(c.id) === selectedId)) {
      setSelectedId(null)
    }
  }, [chapters, selectedId])

  const displayWordCount = countChapterWords(draftContent)

  function handleCreate() {
    const title = createTitle.trim()
    if (!title) {
      toast.warning('请填写章节标题')
      return
    }
    createMutation.mutate({ title })
  }

  function handleSave() {
    if (!selectedId) return
    updateMutation.mutate({
      id: selectedId,
      data: { title: draftTitle.trim(), content: draftContent },
    })
  }

  if (!novelId) return null

  const batches = batchQuery.data ?? []

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">章节</h2>
        <p className="mt-1 text-sm text-muted">章节列表与正文；章号由系统自动分配。</p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={() => {
            setCreateTitle('')
            setCreateOpen(true)
          }}
          onClear={
            chapters.length
              ? () => {
                  for (const ch of chapters) {
                    if (ch.id) deleteMutation.mutate(String(ch.id))
                  }
                  setSelectedId(null)
                }
              : undefined
          }
        >
          <WorkspaceTree
            nodes={treeNodes}
            selectedKey={selectedId}
            onSelect={setSelectedId}
            emptyText="暂无章节，点击 + 新建"
          />
        </ManageTreeSidebar>

        {selectedChapter ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="shrink-0 space-y-1 border-b border-border pb-3">
              <p className="text-xs text-muted">
                {chapterListLabel(Number(selectedChapter.chapterNo), '')}
              </p>
              <TextField value={draftTitle} onChange={setDraftTitle} className="space-y-2">
                <Label>标题</Label>
                <Input />
              </TextField>
              <p className="text-sm text-muted">
                字数：{formatWordCount(displayWordCount)}
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto py-3">
              <TextField value={draftContent} onChange={setDraftContent} className="space-y-2">
                <Label>正文</Label>
                <TextArea rows={16} className="min-h-[240px] font-mono text-sm" />
              </TextField>
            </div>

            <div className={`${FORM_MODAL_SECTION_CLASS} mb-3 max-h-48 shrink-0 overflow-y-auto`}>
              <p className="mb-2 text-sm font-medium">更新记录</p>
              {batchQuery.isLoading ? (
                <p className="text-xs text-muted">加载更新记录…</p>
              ) : batchQuery.isError ? (
                <p className="text-xs text-muted">无法加载更新记录</p>
              ) : batches.length === 0 ? (
                <p className="text-xs text-muted">暂无关联此章节的批量更新记录。</p>
              ) : (
                <div className="space-y-2">
                  {batches.map((batch) => {
                    const rolledBack = Boolean(batch.rolledBackAt)
                    return (
                      <div
                        key={batch.id}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-default/20 p-2"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium">
                              {new Date(batch.createdAt).toLocaleString()}
                            </span>
                            <Chip size="sm" variant={rolledBack ? 'secondary' : 'primary'} className="text-[10px]">
                              <Chip.Label>{rolledBack ? '已回滚' : '有效'}</Chip.Label>
                            </Chip>
                          </div>
                          <p className="text-xs text-muted">
                            {batch.summary.trim() || '（无摘要）'}
                          </p>
                          <p className="text-[10px] text-muted">共 {batch.ops.length} 项变更</p>
                        </div>
                        {!rolledBack ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            isDisabled={rollbackMutation.isPending}
                            onPress={() => rollbackMutation.mutate(batch.id)}
                          >
                            <RotateCcw className="mr-1 h-3 w-3" strokeWidth={1.5} />
                            回滚
                          </Button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <DetailSaveFooter
              onSave={handleSave}
              saving={updateMutation.isPending}
              disabled={!draftTitle.trim()}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <BookOpen className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">选择左侧章节查看正文</p>
          </div>
        )}
      </div>

      <FormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建章节"
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onPress={handleCreate}
              isDisabled={!createTitle.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '创建中…' : '确定'}
            </Button>
          </>
        }
      >
        <TextField value={createTitle} onChange={setCreateTitle} className="space-y-2">
          <Label>章节标题</Label>
          <Input autoFocus placeholder="如：重生、觉醒、决战" />
          <p className="text-xs text-muted">章号将在创建后自动分配。</p>
        </TextField>
      </FormModal>
    </div>
  )
}
