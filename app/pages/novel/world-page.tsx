import { useCallback, useEffect, useMemo, useState } from 'react'
import { Globe, Pencil, Plus, Trash2 } from 'lucide-react'
import { AlertDialog, Button, Input, Label, Tabs, TextArea } from '@heroui/react'
import { useForm, Controller, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { WorkspaceTree, buildHierarchyTree } from '@/app/components/novel-workspace/workspace-tree'
import { DynamicTemplateFields } from '@/app/components/novel-workspace/dynamic-template-fields'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { FormModal, FORM_MODAL_SECTION_CLASS } from '@/app/components/novel-workspace/form-modal'
import { WorldNodeKindSelect } from '@/app/components/novel-workspace/world-node-kind-select'
import { ParentNodeSelect } from '@/app/components/novel-workspace/parent-node-select'
import { TimelineTimePointField, isValidTimePoint } from '@/app/components/novel-workspace/timeline-time-point-field'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { useEntityList, useEntityMutations } from '@/app/hooks/use-entity-crud'
import { useFormTemplateFields } from '@/app/hooks/use-form-template-fields'
import { resolveParentId } from '@/app/lib/parent-ref'
import { filterWorldNodesForTree } from '@/app/lib/manage-tree-filter'
import {
  emptyWorldNodeDetail,
  WORLD_NODE_KIND_LABELS,
  suggestChildKind,
} from '@/app/lib/world-kinds'
import { buildChapterSelectOptions } from '@/app/lib/chapter-utils'
import { SingleCombobox } from '@/app/components/single-combobox'
import { EmptyState } from '@/app/components/empty-state'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'

const DETAIL_KEYS = ['geography', 'culture', 'history', 'factions'] as const
const DETAIL_LABELS: Record<(typeof DETAIL_KEYS)[number], string> = {
  geography: '地理',
  culture: '文化',
  history: '历史',
  factions: '势力',
}

const addNodeSchema = z.object({
  name: z.string().min(1, '请填写节点名称'),
  kind: z.string(),
  parentId: z.string().nullable(),
  detail: z.record(z.string(), z.string()),
  extra: z.record(z.string(), z.unknown()),
})

const detailSchema = z.object({
  name: z.string().min(1, '请填写节点名称'),
  kind: z.string(),
  parentId: z.string().nullable(),
  detail: z.record(z.string(), z.string()),
  extra: z.record(z.string(), z.unknown()),
})

const timelineSchema = z.object({
  timeLabel: z.string().min(1, '请填写时间标记'),
  timePoint: z
    .number({ message: '请填写有效的排序时间点（整数）' })
    .int('请填写有效的排序时间点（整数）'),
  title: z.string(),
  content: z.string(),
  relatedChapterNo: z.string().optional(),
  extra: z.record(z.string(), z.unknown()),
})

type AddNodeValues = z.infer<typeof addNodeSchema>
type DetailValues = z.infer<typeof detailSchema>
type TimelineValues = z.infer<typeof timelineSchema>

function asDetail(raw: unknown): Record<string, string> {
  const base = emptyWorldNodeDetail()
  if (!raw || typeof raw !== 'object') return base
  for (const k of DETAIL_KEYS) base[k] = String((raw as Record<string, unknown>)[k] ?? '')
  return base
}

function asExtra(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
}

function collectDescendantIds(nodes: Record<string, unknown>[], rootId: string): Set<string> {
  const byParent = new Map<string | null, Record<string, unknown>[]>()
  for (const n of nodes) {
    const pid = resolveParentId(nodes, n.parentId)
    const list = byParent.get(pid) ?? []
    list.push(n)
    byParent.set(pid, list)
  }
  const ids = new Set<string>([rootId])
  const stack = [rootId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const child of byParent.get(cur) ?? []) {
      const id = String(child.id)
      if (!ids.has(id)) {
        ids.add(id)
        stack.push(id)
      }
    }
  }
  return ids
}

function chapterRefToSelectValue(
  ref: unknown,
  chapters: Record<string, unknown>[],
): string | undefined {
  if (ref == null || ref === '') return undefined
  if (typeof ref === 'number') {
    const hit = chapters.find((c) => Number(c.chapterNo) === ref)
    return hit?.id ? String(hit.id) : undefined
  }
  const s = String(ref)
  return chapters.some((c) => String(c.id) === s) ? s : undefined
}

function onlyAddChildOnSelected(
  nodes: ReturnType<typeof buildHierarchyTree>,
  selectedId: string | null,
): ReturnType<typeof buildHierarchyTree> {
  return nodes.map((n) => ({
    ...n,
    onAddChild: selectedId === n.key ? n.onAddChild : undefined,
    children: n.children ? onlyAddChildOnSelected(n.children, selectedId) : undefined,
  }))
}

function splitTimelineExtraFields(fields: FormFieldDef[]) {
  const extra = fields.filter((f) => f.key !== 'content')
  const content = fields.find((f) => f.key === 'content') ?? null
  return { extra, content }
}

export function NovelWorldPage() {
  const { novelId } = useNovelRouteContext('world')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('detail')
  const [filterText, setFilterText] = useState('')

  const [addOpen, setAddOpen] = useState(false)

  const [tlOpen, setTlOpen] = useState(false)
  const [tlEditingId, setTlEditingId] = useState<string | null>(null)

  const addForm = useForm<AddNodeValues>({
    resolver: zodResolver(addNodeSchema),
    defaultValues: {
      name: '',
      kind: 'universe',
      parentId: null,
      detail: emptyWorldNodeDetail(),
      extra: {},
    },
  })

  const detailForm = useForm<DetailValues>({
    resolver: zodResolver(detailSchema),
    defaultValues: {
      name: '',
      kind: 'custom',
      parentId: null,
      detail: emptyWorldNodeDetail(),
      extra: {},
    },
  })

  const timelineForm = useForm<TimelineValues>({
    resolver: zodResolver(timelineSchema),
    defaultValues: {
      timeLabel: '',
      timePoint: 0,
      title: '',
      content: '',
      relatedChapterNo: undefined,
      extra: {},
    },
  })

  const nodesQuery = useEntityList(novelId, 'world')
  const chaptersQuery = useEntityList(novelId, 'chapter')
  const timelineQuery = useEntityList(
    novelId,
    'worldTimeline',
    selectedId ? { where: { worldNodeId: selectedId } } : { where: { worldNodeId: '__none__' } },
  )

  const { fields: detailTemplateFields } = useFormTemplateFields(novelId, 'world')
  const { fields: tlTemplateFields } = useFormTemplateFields(novelId, 'world', 'timeline')
  const { extra: tlExtraFields, content: tlContentField } = useMemo(
    () => splitTimelineExtraFields(tlTemplateFields),
    [tlTemplateFields],
  )

  const nodes = (nodesQuery.data ?? []) as Record<string, unknown>[]
  const chapters = (chaptersQuery.data ?? []) as Record<string, unknown>[]
  const timelineEntries = selectedId ? ((timelineQuery.data ?? []) as Record<string, unknown>[]) : []
  const chapterOptions = useMemo(() => buildChapterSelectOptions(chapters), [chapters])

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find((n) => String(n.id) === selectedId) ?? null : null),
    [nodes, selectedId],
  )

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'world', {
    onCreated: (id) => setSelectedId(id),
  })
  const tlMutations = useEntityMutations(novelId, 'worldTimeline', {
    invalidateDomains: ['worldTimeline'],
  })

  useEffect(() => {
    if (!selectedNode) return
    detailForm.reset({
      name: String(selectedNode.name ?? ''),
      kind: String(selectedNode.kind ?? 'custom'),
      parentId: resolveParentId(nodes, selectedNode.parentId),
      detail: asDetail(selectedNode.detail),
      extra: asExtra(selectedNode.extra),
    })
  }, [selectedNode, nodes, detailForm])

  const filteredNodes = useMemo(
    () => filterWorldNodesForTree(nodes, filterText),
    [nodes, filterText],
  )

  const openAddModal = useCallback(
    (parentId: string | null) => {
      const parent = parentId ? nodes.find((n) => String(n.id) === parentId) : null
      addForm.reset({
        name: '',
        kind: suggestChildKind(parent ? String(parent.kind) : null),
        parentId,
        detail: emptyWorldNodeDetail(),
        extra: {},
      })
      setAddOpen(true)
    },
    [nodes, addForm],
  )

  const treeNodes = useMemo(() => {
    const built = buildHierarchyTree(filteredNodes, (item) => (
      <span className="inline-flex max-w-full min-w-0 items-center">
        <span className="min-w-0 truncate">{String(item.name ?? '未命名')}</span>
        <span className="ml-1 shrink-0 text-xs text-muted">
          {WORLD_NODE_KIND_LABELS[String(item.kind ?? '')] ?? String(item.kind ?? '')}
        </span>
      </span>
    ), {
      getTooltip: (item) => String(item.name ?? '未命名'),
      sortSiblings: (a, b) =>
        Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
        String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-CN'),
      onDelete: (item) => deleteMutation.mutate(String(item.id)),
      onAddChild: (item) => openAddModal(String(item.id)),
      deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
    })
    return onlyAddChildOnSelected(built, selectedId)
  }, [filteredNodes, selectedId, deleteMutation, openAddModal])

  const parentPickerExclude = useMemo(() => {
    if (!selectedId) return undefined
    return collectDescendantIds(nodes, selectedId)
  }, [nodes, selectedId])

  const worldParentLabel = useCallback(
    (item: Record<string, unknown>) => (
      <span className="inline-flex max-w-full min-w-0 items-center">
        <span className="min-w-0 truncate">{String(item.name ?? '未命名')}</span>
        <span className="ml-1 shrink-0 text-xs text-muted">
          {WORLD_NODE_KIND_LABELS[String(item.kind ?? '')] ?? String(item.kind ?? '')}
        </span>
      </span>
    ),
    [],
  )

  const worldParentSort = useCallback(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
      String(a.name ?? '').localeCompare(String(b.name ?? ''), 'zh-CN'),
    [],
  )

  function handleCreateNode(values: AddNodeValues) {
    createMutation.mutate({
      name: values.name.trim(),
      kind: values.kind,
      parentId: values.parentId,
      detail: values.detail,
      extra: values.extra,
    })
    setAddOpen(false)
  }

  function handleSaveDetail(values: DetailValues) {
    if (!selectedId) return
    updateMutation.mutate({
      id: selectedId,
      data: {
        name: values.name.trim(),
        kind: values.kind,
        parentId: values.parentId,
        detail: values.detail,
        extra: values.extra,
      },
    })
  }

  function openTlCreate() {
    setTlEditingId(null)
    timelineForm.reset({
      timeLabel: '',
      timePoint: 0,
      title: '',
      content: '',
      relatedChapterNo: undefined,
      extra: {},
    })
    setTlOpen(true)
  }

  function openTlEdit(entry: Record<string, unknown>) {
    setTlEditingId(String(entry.id))
    timelineForm.reset({
      timeLabel: String(entry.timeLabel ?? ''),
      timePoint: typeof entry.timePoint === 'number' ? entry.timePoint : Number(entry.timePoint) || 0,
      title: String(entry.title ?? ''),
      content: String(entry.content ?? ''),
      relatedChapterNo: chapterRefToSelectValue(entry.relatedChapterNo, chapters),
      extra: asExtra(entry.extra),
    })
    setTlOpen(true)
  }

  function handleSaveTimeline(values: TimelineValues) {
    if (!selectedId) return
    const payload = {
      timeLabel: values.timeLabel.trim(),
      timePoint: values.timePoint,
      title: values.title,
      content: values.content,
      relatedChapterNo: values.relatedChapterNo ?? null,
      extra: values.extra,
    }
    if (tlEditingId) {
      tlMutations.updateMutation.mutate({ id: tlEditingId, data: payload })
    } else {
      tlMutations.createMutation.mutate({ worldNodeId: selectedId, ...payload })
    }
    setTlOpen(false)
  }

  if (!novelId) return <div className="text-sm text-muted">加载中…</div>

  const addParentId = addForm.watch('parentId')
  const addParentNode = addParentId ? nodes.find((n) => String(n.id) === addParentId) : null
  const addExtra = addForm.watch('extra')
  const detailExtra = detailForm.watch('extra')
  const tlExtra = timelineForm.watch('extra')

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">世界</h2>
        <p className="mt-1 text-sm text-muted">
          世界观节点树与详情；选中节点后可编辑详情或记录世界线变化。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={() => openAddModal(null)}
          onClear={
            nodes.length
              ? () => {
                  for (const n of nodes) {
                    if (n.id) deleteMutation.mutate(String(n.id))
                  }
                  setSelectedId(null)
                }
              : undefined
          }
          showFilter
          filterText={filterText}
          onFilterTextChange={setFilterText}
        >
          <WorkspaceTree
            nodes={treeNodes}
            selectedKey={selectedId}
            onSelect={setSelectedId}
            emptyText={filterText.trim() ? '无匹配节点' : '暂无节点，点击 + 添加根节点'}
          />
        </ManageTreeSidebar>

        {selectedNode ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))} className="flex min-h-0 flex-1 flex-col">
              <Tabs.ListContainer><Tabs.List>
                <Tabs.Tab id="detail">详情</Tabs.Tab>
                <Tabs.Tab id="timeline">世界线</Tabs.Tab>
              </Tabs.List></Tabs.ListContainer>

              <Tabs.Panel id="detail" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <FormProvider {...detailForm}>
                  <form
                    className="flex min-h-0 flex-1 flex-col overflow-hidden"
                    onSubmit={detailForm.handleSubmit(handleSaveDetail)}
                  >
                    <div className="min-h-0 flex-1 overflow-auto pr-1">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Controller
                          control={detailForm.control}
                          name="name"
                          render={({ field, fieldState }) => (
                            <div>
                              <Label htmlFor="detail-name">名称</Label>
                              <Input id="detail-name" aria-invalid={fieldState.invalid} {...field} />
                              {fieldState.error ? <p className="text-danger text-sm">{fieldState.error.message}</p> : null}
                            </div>
                          )}
                        />
                        <Controller
                          control={detailForm.control}
                          name="kind"
                          render={({ field, fieldState }) => (
                            <div>
                              <WorldNodeKindSelect
                                value={field.value}
                                onChange={field.onChange}
                                label="层级类型"
                              />
                              {fieldState.error ? <p className="text-danger text-sm">{fieldState.error.message}</p> : null}
                            </div>
                          )}
                        />
                        <Controller
                          control={detailForm.control}
                          name="parentId"
                          render={({ field, fieldState }) => (
                            <>
                              <ParentNodeSelect
                                id="detail-parent"
                                className="sm:col-span-2"
                                value={field.value}
                                onChange={field.onChange}
                                items={nodes}
                                excludeIds={parentPickerExclude}
                                getLabel={worldParentLabel}
                                sortSiblings={worldParentSort}
                              />
                              {fieldState.error ? (
                                <p className="text-danger text-sm">{fieldState.error.message}</p>
                              ) : null}
                            </>
                          )}
                        />
                      </div>

                      <div className={`${FORM_MODAL_SECTION_CLASS} mt-4`}>
                        <p className="mb-3 text-sm font-medium">节点详情</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {DETAIL_KEYS.map((key) => (
                            <Controller
                              key={key}
                              control={detailForm.control}
                              name={`detail.${key}`}
                              render={({ field }) => (
                                <div className="sm:col-span-2">
                                  <Label htmlFor={`detail-${key}`}>{DETAIL_LABELS[key]}</Label>
                                  <TextArea id={`detail-${key}`} rows={4} {...field} />
                                </div>
                              )}
                            />
                          ))}
                        </div>
                        {detailTemplateFields.length > 0 ? (
                          <div className="mt-4">
                            <DynamicTemplateFields
                              fields={detailTemplateFields}
                              value={detailExtra}
                              onChange={(next) => detailForm.setValue('extra', next, { shouldDirty: true })}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <DetailSaveFooter
                      onSave={() => void detailForm.handleSubmit(handleSaveDetail)()}
                      saving={updateMutation.isPending}
                      disabled={!detailForm.watch('name')?.trim()}
                    />
                  </form>
                </FormProvider>
              </Tabs.Panel>

              <Tabs.Panel id="timeline" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <p className="text-xs text-muted">按排序时间点排列</p>
                  <Button type="button" size="sm" onPress={openTlCreate}>
                    <Plus data-icon="inline-start" strokeWidth={1.5} />
                    添加世界线记录
                  </Button>
                </div>
                {timelineQuery.isLoading ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted">加载中…</div>
                ) : timelineEntries.length === 0 ? (
                  <EmptyState className="flex-1" icon={<Globe />} title="暂无世界线记录" description="添加第一条世界线变化记录" />
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                    {timelineEntries.map((entry) => (
                      <div
                        key={String(entry.id)}
                        className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {String(entry.timeLabel ?? '')}
                            <span className="ml-1 text-xs font-normal text-muted">
                              ({String(entry.timePoint ?? '')})
                            </span>
                            {String(entry.title ?? '').trim() ? (
                              <span className="ml-1 font-normal text-muted">· {String(entry.title)}</span>
                            ) : null}
                          </p>
                          {String(entry.content ?? '').trim() ? (
                            <p className="truncate text-xs text-muted">{String(entry.content)}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <Button type="button" variant="ghost" isIconOnly className="h-8 w-8" onPress={() => openTlEdit(entry)}>
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </Button>
                          <AlertDialog>
                            <AlertDialog.Trigger><Button type="button" variant="ghost" isIconOnly className="h-8 w-8 text-danger">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </Button>
                            </AlertDialog.Trigger>
                            <AlertDialog.Backdrop><AlertDialog.Container><AlertDialog.Dialog className="app-no-drag">
                              <AlertDialog.Header><AlertDialog.Heading>确定删除该世界线记录？</AlertDialog.Heading></AlertDialog.Header><AlertDialog.Body><p className="text-muted text-sm">此操作不可撤销。</p></AlertDialog.Body>
                              <AlertDialog.Footer>
                                <Button slot="close" variant="outline">取消</Button>
                                <Button slot="close" variant="danger" onPress={() => tlMutations.deleteMutation.mutate(String(entry.id))}>
                                  删除
                                </Button>
                              </AlertDialog.Footer>
                            </AlertDialog.Dialog></AlertDialog.Container></AlertDialog.Backdrop>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Tabs.Panel>
            </Tabs>
          </div>
        ) : (
          <EmptyState className="flex-1" icon={<Globe />} title="选择左侧节点查看详情" />
        )}
      </div>

      <FormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title={addParentNode ? `添加子节点 · ${String(addParentNode.name)}` : '添加根节点'}
        formId="world-add-form"
        onSubmit={addForm.handleSubmit(handleCreateNode)}
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setAddOpen(false)}>
              取消
            </Button>
            <Button type="submit" form="world-add-form" isDisabled={createMutation.isPending}>
              {createMutation.isPending ? '添加中…' : '确定'}
            </Button>
          </>
        }
      >
        <FormProvider {...addForm}>
          <div className="flex flex-col gap-3">
            <Controller
              control={addForm.control}
              name="name"
              render={({ field, fieldState }) => (
                <div>
                  <Label htmlFor="add-name">名称</Label>
                  <Input id="add-name" autoFocus aria-invalid={fieldState.invalid} placeholder="节点名称" {...field} />
                  {fieldState.error ? <p className="text-danger text-sm">{fieldState.error.message}</p> : null}
                </div>
              )}
            />
            <Controller
              control={addForm.control}
              name="parentId"
              render={({ field }) => (
                <ParentNodeSelect
                  id="add-parent"
                  value={field.value}
                  onChange={field.onChange}
                  items={nodes}
                  getLabel={worldParentLabel}
                  sortSiblings={worldParentSort}
                />
              )}
            />
            <Controller
              control={addForm.control}
              name="kind"
              render={({ field }) => (
                <WorldNodeKindSelect value={field.value} onChange={field.onChange} />
              )}
            />
            <div className={FORM_MODAL_SECTION_CLASS}>
              <p className="mb-3 text-sm font-medium">节点详情</p>
              <div className="flex flex-col gap-4">
                {DETAIL_KEYS.map((key) => (
                  <Controller
                    key={key}
                    control={addForm.control}
                    name={`detail.${key}`}
                    render={({ field }) => (
                      <div>
                        <Label htmlFor={`add-${key}`}>{DETAIL_LABELS[key]}</Label>
                        <TextArea id={`add-${key}`} rows={3} {...field} />
                      </div>
                    )}
                  />
                ))}
              </div>
              {detailTemplateFields.length > 0 ? (
                <div className="mt-4">
                  <DynamicTemplateFields
                    fields={detailTemplateFields}
                    value={addExtra}
                    onChange={(next) => addForm.setValue('extra', next, { shouldDirty: true })}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </FormProvider>
      </FormModal>

      <FormModal
        open={tlOpen}
        onOpenChange={setTlOpen}
        title={tlEditingId ? '编辑世界线记录' : '添加世界线记录'}
        formId="world-timeline-form"
        onSubmit={timelineForm.handleSubmit(handleSaveTimeline)}
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setTlOpen(false)}>
              取消
            </Button>
            <Button
              type="submit"
              form="world-timeline-form"
              isDisabled={tlMutations.createMutation.isPending || tlMutations.updateMutation.isPending}
            >
              确定
            </Button>
          </>
        }
      >
        <FormProvider {...timelineForm}>
          <div className="flex flex-col gap-3">
            <Controller
              control={timelineForm.control}
              name="timeLabel"
              render={({ field, fieldState }) => (
                <div>
                  <Label htmlFor="tl-time-label">时间标记</Label>
                  <Input
                    id="tl-time-label"
                    autoFocus
                    aria-invalid={fieldState.invalid}
                    placeholder="如：太古元年"
                    {...field}
                  />
                  {fieldState.error ? <p className="text-danger text-sm">{fieldState.error.message}</p> : null}
                </div>
              )}
            />
            <Controller
              control={timelineForm.control}
              name="timePoint"
              render={({ field, fieldState }) => (
                <div>
                  <TimelineTimePointField
                    value={isValidTimePoint(field.value) ? field.value : null}
                    onChange={(v) => field.onChange(v ?? 0)}
                  />
                  {fieldState.error ? <p className="text-danger text-sm">{fieldState.error.message}</p> : null}
                </div>
              )}
            />
            <Controller
              control={timelineForm.control}
              name="title"
              render={({ field }) => (
                <div>
                  <Label htmlFor="tl-title">标题（可选）</Label>
                  <Input id="tl-title" {...field} />
                </div>
              )}
            />
            <Controller
              control={timelineForm.control}
              name="relatedChapterNo"
              render={({ field }) => (
                <div>
                  <Label htmlFor="tl-chapter">关联章节</Label>
                  <SingleCombobox
                    id="tl-chapter"
                    className="w-full"
                    value={field.value ?? ''}
                    placeholder="选择关联章节（可选）"
                    onValueChange={field.onChange}
                    options={chapterOptions}
                  />
                </div>
              )}
            />
            <Controller
              control={timelineForm.control}
              name="content"
              render={({ field }) => (
                <div>
                  <Label htmlFor="tl-content">{tlContentField?.label ?? '事件内容'}</Label>
                  <TextArea
                    id="tl-content"
                    rows={tlContentField?.rows ?? 4}
                    placeholder={tlContentField?.placeholder ?? '描述该时间点世界/节点的变化…'}
                    {...field}
                  />
                </div>
              )}
            />
            {tlExtraFields.length > 0 ? (
              <div className={FORM_MODAL_SECTION_CLASS}>
                <p className="mb-3 text-sm font-medium">扩展字段</p>
                <DynamicTemplateFields
                  fields={tlExtraFields}
                  value={tlExtra}
                  onChange={(next) => timelineForm.setValue('extra', next, { shouldDirty: true })}
                />
              </div>
            ) : null}
          </div>
        </FormProvider>
      </FormModal>
    </div>
  )
}
