import { useEffect, useMemo, useState } from 'react'
import { Bug, Pencil, Plus, Trash2 } from 'lucide-react'
import { AlertDialog, Button, Input, Label, Tabs, TextArea } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { WorkspaceTree, buildFlatTree } from '@/app/components/novel-workspace/workspace-tree'
import {
  DynamicTemplateFields,
  applyFieldDefaults,
} from '@/app/components/novel-workspace/dynamic-template-fields'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { FormModal, FORM_MODAL_SECTION_CLASS } from '@/app/components/novel-workspace/form-modal'
import { TimelineTimePointField, isValidTimePoint } from '@/app/components/novel-workspace/timeline-time-point-field'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { useEntityList, useEntityMutations } from '@/app/hooks/use-entity-crud'
import { useFormTemplateFields } from '@/app/hooks/use-form-template-fields'
import { filterFlatList } from '@/app/lib/manage-tree-filter'
import { buildChapterSelectOptions } from '@/app/lib/chapter-utils'
import { SingleCombobox } from '@/app/components/single-combobox'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'

const CREATURE_KIND_LABELS: Record<string, string> = {
  animal: '动物',
  beast: '异兽',
  plant: '植物',
  spirit: '灵体',
  other: '其他',
}

const CREATURE_KINDS = ['animal', 'beast', 'plant', 'spirit', 'other'] as const
const CREATURE_KIND_OPTIONS = CREATURE_KINDS.map((k) => ({
  label: CREATURE_KIND_LABELS[k],
  value: k,
}))

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
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

function splitTimelineExtraFields(fields: FormFieldDef[]) {
  const extra = fields.filter((f) => f.key !== 'content')
  const content = fields.find((f) => f.key === 'content') ?? null
  return { extra, content }
}

export function NovelCreaturePage() {
  const { novelId } = useNovelRouteContext('creature')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('detail')
  const [filterText, setFilterText] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addKind, setAddKind] = useState<string>('other')

  const [draftName, setDraftName] = useState('')
  const [draftKind, setDraftKind] = useState('other')
  const [draftOwner, setDraftOwner] = useState('')
  const [draftProfile, setDraftProfile] = useState<Record<string, unknown>>({})

  const [tlOpen, setTlOpen] = useState(false)
  const [tlEditingId, setTlEditingId] = useState<string | null>(null)
  const [tlTimeLabel, setTlTimeLabel] = useState('')
  const [tlTimePoint, setTlTimePoint] = useState<number | null>(null)
  const [tlTitle, setTlTitle] = useState('')
  const [tlContent, setTlContent] = useState('')
  const [tlChapterId, setTlChapterId] = useState<string | undefined>()
  const [tlExtra, setTlExtra] = useState<Record<string, unknown>>({})

  const listQuery = useEntityList(novelId, 'creature')
  const rolesQuery = useEntityList(novelId, 'role')
  const chaptersQuery = useEntityList(novelId, 'chapter')
  const timelineQuery = useEntityList(
    novelId,
    'creatureTimeline',
    selectedId ? { where: { creatureId: selectedId } } : { where: { creatureId: '__none__' } },
  )

  const { fields: detailFields } = useFormTemplateFields(novelId, 'creature')
  const { fields: tlTemplateFields } = useFormTemplateFields(novelId, 'creature', 'timeline')
  const { extra: tlExtraFields, content: tlContentField } = useMemo(
    () => splitTimelineExtraFields(tlTemplateFields),
    [tlTemplateFields],
  )

  const creatures = (listQuery.data ?? []) as Record<string, unknown>[]
  const roles = (rolesQuery.data ?? []) as Record<string, unknown>[]
  const chapters = (chaptersQuery.data ?? []) as Record<string, unknown>[]
  const timelineEntries = selectedId ? ((timelineQuery.data ?? []) as Record<string, unknown>[]) : []
  const chapterOptions = useMemo(() => buildChapterSelectOptions(chapters), [chapters])

  const roleOptions = useMemo(() => {
    const seen = new Set<string>()
    return roles
      .map((r) => String(r.name ?? '').trim() || '未命名')
      .filter((name) => {
        if (seen.has(name)) return false
        seen.add(name)
        return true
      })
      .map((name) => ({ label: name, value: name }))
  }, [roles])

  const ownerComboboxOptions = useMemo(
    () => [{ label: '无主', value: '__none__' }, ...roleOptions],
    [roleOptions],
  )

  const filteredCreatures = useMemo(
    () =>
      filterFlatList(creatures, filterText, (item) => {
        const kind = CREATURE_KIND_LABELS[String(item.kind ?? '')] ?? String(item.kind ?? '')
        return `${String(item.name ?? '')} ${kind} ${String(item.owner ?? '')}`
      }),
    [creatures, filterText],
  )

  const selectedCreature = useMemo(
    () => (selectedId ? creatures.find((c) => String(c.id) === selectedId) ?? null : null),
    [creatures, selectedId],
  )

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'creature', {
    onCreated: (id) => {
      setSelectedId(id)
      setActiveTab('detail')
    },
  })
  const tlMutations = useEntityMutations(novelId, 'creatureTimeline')

  const treeNodes = useMemo(
    () =>
      buildFlatTree(filteredCreatures, (creature) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{String(creature.name ?? '未命名')}</span>
          <span className="text-xs text-muted">
            {CREATURE_KIND_LABELS[String(creature.kind ?? '')] ?? String(creature.kind ?? '')}
            {String(creature.owner ?? '').trim()
              ? ` · 主人：${String(creature.owner).trim()}`
              : ''}
          </span>
        </span>
      ), {
        getTooltip: (creature) => String(creature.name ?? '未命名'),
        onDelete: (creature) => {
          const id = String(creature.id)
          deleteMutation.mutate(id)
          if (selectedId === id) setSelectedId(null)
        },
        deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
      }),
    [filteredCreatures, deleteMutation, selectedId],
  )

  useEffect(() => {
    if (!selectedCreature) return
    setDraftName(String(selectedCreature.name ?? ''))
    setDraftKind(String(selectedCreature.kind ?? 'other'))
    setDraftOwner(String(selectedCreature.owner ?? ''))
    setDraftProfile(applyFieldDefaults(asRecord(selectedCreature.profile), detailFields))
  }, [selectedCreature, detailFields])

  function handleCreate() {
    const name = addName.trim()
    if (!name) {
      toast.warning('请填写生物名称')
      return
    }
    createMutation.mutate({ name, kind: addKind, owner: '', profile: {} })
    setAddOpen(false)
    setAddName('')
    setAddKind('other')
  }

  function handleSaveDetail() {
    if (!selectedId) return
    updateMutation.mutate({
      id: selectedId,
      data: {
        name: draftName.trim(),
        kind: draftKind,
        owner: draftOwner.trim(),
        profile: draftProfile,
      },
    })
  }

  function openTlCreate() {
    setTlEditingId(null)
    setTlTimeLabel('')
    setTlTimePoint(null)
    setTlTitle('')
    setTlContent('')
    setTlChapterId(undefined)
    setTlExtra({})
    setTlOpen(true)
  }

  function openTlEdit(entry: Record<string, unknown>) {
    setTlEditingId(String(entry.id))
    setTlTimeLabel(String(entry.timeLabel ?? ''))
    setTlTimePoint(typeof entry.timePoint === 'number' ? entry.timePoint : Number(entry.timePoint) || null)
    setTlTitle(String(entry.title ?? ''))
    setTlContent(String(entry.content ?? ''))
    setTlChapterId(chapterRefToSelectValue(entry.relatedChapterNo, chapters))
    setTlExtra(asRecord(entry.extra))
    setTlOpen(true)
  }

  function handleSaveTimeline() {
    if (!selectedId) return
    const timeLabel = tlTimeLabel.trim()
    if (!timeLabel) {
      toast.warning('请填写时间标记')
      return
    }
    if (!isValidTimePoint(tlTimePoint)) {
      toast.warning('请填写有效的排序时间点（整数）')
      return
    }
    const payload = {
      timeLabel,
      timePoint: tlTimePoint,
      title: tlTitle,
      content: tlContent,
      relatedChapterNo: tlChapterId ?? null,
      extra: tlExtra,
    }
    if (tlEditingId) {
      tlMutations.updateMutation.mutate({ id: tlEditingId, data: payload })
    } else {
      tlMutations.createMutation.mutate({ creatureId: selectedId, ...payload })
    }
    setTlOpen(false)
  }

  if (!novelId) return null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">生物</h2>
        <p className="mt-1 text-sm text-muted">
          动物、异兽、灵植、灵体等档案；选中后可编辑详情与时间线记录。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={() => {
            setAddName('')
            setAddKind('other')
            setAddOpen(true)
          }}
          onClear={
            creatures.length
              ? () => {
                  for (const c of creatures) {
                    if (c.id) deleteMutation.mutate(String(c.id))
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
            onSelect={(id) => {
              setSelectedId(id)
              setActiveTab('detail')
            }}
            emptyText={filterText.trim() ? '无匹配生物' : '暂无生物，点击 + 添加'}
          />
        </ManageTreeSidebar>

        {selectedCreature ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))} className="flex min-h-0 flex-1 flex-col">
              <Tabs.ListContainer><Tabs.List>
                <Tabs.Tab id="detail">详情</Tabs.Tab>
                <Tabs.Tab id="timeline">时间</Tabs.Tab>
              </Tabs.List></Tabs.ListContainer>

              <Tabs.Panel id="detail" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 flex flex-col gap-5 overflow-auto pr-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      <Label>生物名称</Label>
                      <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-3">
                      <Label>种类</Label>
                      <SingleCombobox
                        value={draftKind}
                        onValueChange={setDraftKind}
                        options={CREATURE_KIND_OPTIONS}
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:col-span-2">
                      <Label>主人</Label>
                      <SingleCombobox
                        value={draftOwner || '__none__'}
                        placeholder="选择主人（可选）"
                        onValueChange={(v) => setDraftOwner(v === '__none__' ? '' : v)}
                        options={ownerComboboxOptions}
                      />
                    </div>
                  </div>
                  {detailFields.length > 0 ? (
                    <DynamicTemplateFields fields={detailFields} value={draftProfile} onChange={setDraftProfile} />
                  ) : (
                    <p className="text-sm text-muted">暂无详情字段配置。</p>
                  )}
                </div>
                <DetailSaveFooter
                  onSave={handleSaveDetail}
                  saving={updateMutation.isPending}
                  disabled={!draftName.trim()}
                />
              </Tabs.Panel>

              <Tabs.Panel id="timeline" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex shrink-0 justify-end">
                  <Button type="button" size="sm" onPress={openTlCreate}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    添加时间记录
                  </Button>
                </div>
                {timelineQuery.isLoading ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted">加载中…</div>
                ) : timelineEntries.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted">暂无时间记录</div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                    {timelineEntries.map((entry) => (
                      <div key={String(entry.id)} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
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
                              <AlertDialog.Header><AlertDialog.Heading>确定删除该时间记录？</AlertDialog.Heading></AlertDialog.Header><AlertDialog.Body><p className="text-muted text-sm">此操作不可撤销。</p></AlertDialog.Body>
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
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <Bug className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">选择左侧生物查看详情</p>
          </div>
        )}
      </div>

      <FormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="添加生物"
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setAddOpen(false)}>
              取消
            </Button>
            <Button type="button" onPress={handleCreate} isDisabled={!addName.trim() || createMutation.isPending}>
              {createMutation.isPending ? '添加中…' : '确定'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Label>生物名称</Label>
            <Input value={addName} autoFocus onChange={(e) => setAddName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-3">
            <Label>种类</Label>
            <SingleCombobox
              value={addKind}
              onValueChange={setAddKind}
              options={CREATURE_KIND_OPTIONS}
            />
          </div>
        </div>
      </FormModal>

      <FormModal
        open={tlOpen}
        onOpenChange={setTlOpen}
        title={tlEditingId ? '编辑时间记录' : '添加时间记录'}
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setTlOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onPress={handleSaveTimeline}
              isDisabled={
                !tlTimeLabel.trim() ||
                !isValidTimePoint(tlTimePoint) ||
                tlMutations.createMutation.isPending ||
                tlMutations.updateMutation.isPending
              }
            >
              确定
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Label>时间标记</Label>
            <Input value={tlTimeLabel} autoFocus onChange={(e) => setTlTimeLabel(e.target.value)} />
          </div>
          <TimelineTimePointField value={tlTimePoint} onChange={setTlTimePoint} />
          <div className="flex flex-col gap-3">
            <Label>标题（可选）</Label>
            <Input value={tlTitle} onChange={(e) => setTlTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-3">
            <Label>关联章节</Label>
            <SingleCombobox
              value={tlChapterId ?? ''}
              placeholder="选择关联章节（可选）"
              onValueChange={setTlChapterId}
              options={chapterOptions}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label>{tlContentField?.label ?? '事件内容'}</Label>
            <TextArea
              value={tlContent}
              rows={tlContentField?.rows ?? 4}
              onChange={(e) => setTlContent(e.target.value)}
            />
          </div>
          {tlExtraFields.length > 0 ? (
            <div className={FORM_MODAL_SECTION_CLASS}>
              <p className="mb-3 text-sm font-medium">扩展字段</p>
              <DynamicTemplateFields fields={tlExtraFields} value={tlExtra} onChange={setTlExtra} />
            </div>
          ) : null}
        </div>
      </FormModal>
    </div>
  )
}
