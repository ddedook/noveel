import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, Trash2, User } from 'lucide-react'
import { AlertDialog, Button, Input, Label, Tabs, TextArea } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { WorkspaceTree, type WorkspaceTreeNode } from '@/app/components/novel-workspace/workspace-tree'
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
import { filterRolesForTree } from '@/app/lib/manage-tree-filter'
import {
  buildRoleFactionTreeData,
  isRoleGroupKey,
  worldAffiliationOptions,
  type RoleFactionTreeNode,
} from '@/app/lib/role-faction-tree'
import { buildChapterSelectOptions } from '@/app/lib/chapter-utils'
import { SingleCombobox } from '@/app/components/single-combobox'
import type { ComboboxOptionGroup } from '@/app/components/single-combobox'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'

const RELATION_TYPE_OPTIONS = [
  { label: '亲属', value: '亲属' },
  { label: '师徒', value: '师徒' },
  { label: '盟友', value: '盟友' },
  { label: '敌对', value: '敌对' },
  { label: '挚友', value: '挚友' },
  { label: '恋人', value: '恋人' },
  { label: '仇人', value: '仇人' },
  { label: '从属', value: '从属' },
]

function affiliationComboboxOptions(
  affiliationOptions: Array<{ label: string; value: string; group?: string }>,
): ComboboxOptionGroup[] {
  return [
    { label: '归属', options: [{ value: '__none__', label: '未归属' }] },
    ...(['势力', '城市'] as const)
      .map((group) => ({
        label: group,
        options: affiliationOptions
          .filter((o) => o.group === group)
          .map((o) => ({ value: o.value, label: o.label })),
      }))
      .filter((g) => g.options.length > 0),
  ]
}

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

function toWorkspaceNodes(
  nodes: RoleFactionTreeNode[],
  opts: {
    selectedId: string | null
    onDeleteRole: (id: string) => void
    deleteLoadingId: string | null
  },
): WorkspaceTreeNode[] {
  return nodes.map((n) => {
    const isGroup = isRoleGroupKey(n.key)
    return {
      key: n.key,
      label:
        n.count != null ? (
          <span className="inline-flex max-w-full min-w-0 items-center gap-1">
            <span className="min-w-0 truncate font-medium">{n.label}</span>
            <span className="shrink-0 text-xs text-muted">{n.count}</span>
          </span>
        ) : (
          n.label
        ),
      tooltip: !isGroup ? n.label : undefined,
      selectable: !isGroup,
      children: n.children ? toWorkspaceNodes(n.children, opts) : undefined,
      onDelete: !isGroup ? () => opts.onDeleteRole(n.key) : undefined,
      deleteLoading: opts.deleteLoadingId === n.key,
    }
  })
}

export function NovelRolePage() {
  const { novelId } = useNovelRouteContext('role')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('detail')
  const [filterText, setFilterText] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addFaction, setAddFaction] = useState('')

  const [draftName, setDraftName] = useState('')
  const [draftFaction, setDraftFaction] = useState('')
  const [draftProfile, setDraftProfile] = useState<Record<string, unknown>>({})

  const [rlOpen, setRlOpen] = useState(false)
  const [rlEditingId, setRlEditingId] = useState<string | null>(null)
  const [rlToRoleId, setRlToRoleId] = useState('')
  const [rlRelationType, setRlRelationType] = useState('')
  const [rlContent, setRlContent] = useState('')
  const [rlExtra, setRlExtra] = useState<Record<string, unknown>>({})

  const [tlOpen, setTlOpen] = useState(false)
  const [tlEditingId, setTlEditingId] = useState<string | null>(null)
  const [tlTimeLabel, setTlTimeLabel] = useState('')
  const [tlTimePoint, setTlTimePoint] = useState<number | null>(null)
  const [tlTitle, setTlTitle] = useState('')
  const [tlContent, setTlContent] = useState('')
  const [tlChapterId, setTlChapterId] = useState<string | undefined>()
  const [tlExtra, setTlExtra] = useState<Record<string, unknown>>({})

  const rolesQuery = useEntityList(novelId, 'role')
  const worldQuery = useEntityList(novelId, 'world')
  const chaptersQuery = useEntityList(novelId, 'chapter')
  const relationsQuery = useEntityList(
    novelId,
    'roleRelation',
    selectedId ? { where: { fromRoleId: selectedId } } : { where: { fromRoleId: '__none__' } },
  )
  const timelineQuery = useEntityList(
    novelId,
    'roleTimeline',
    selectedId ? { where: { roleId: selectedId } } : { where: { roleId: '__none__' } },
  )

  const { fields: detailFieldsRaw } = useFormTemplateFields(novelId, 'role')
  const { fields: rlTemplateFields } = useFormTemplateFields(novelId, 'role', 'relation')
  const { fields: tlTemplateFields } = useFormTemplateFields(novelId, 'role', 'timeline')

  const detailFields = useMemo(
    () => detailFieldsRaw.filter((f) => f.key !== 'faction'),
    [detailFieldsRaw],
  )
  const { extra: tlExtraFields, content: tlContentField } = useMemo(
    () => splitTimelineExtraFields(tlTemplateFields),
    [tlTemplateFields],
  )

  const roles = (rolesQuery.data ?? []) as Record<string, unknown>[]
  const worldNodes = (worldQuery.data ?? []) as Record<string, unknown>[]
  const chapters = (chaptersQuery.data ?? []) as Record<string, unknown>[]
  const relations = selectedId ? ((relationsQuery.data ?? []) as Record<string, unknown>[]) : []
  const timelineEntries = selectedId ? ((timelineQuery.data ?? []) as Record<string, unknown>[]) : []
  const chapterOptions = useMemo(() => buildChapterSelectOptions(chapters), [chapters])

  const affiliationOptions = useMemo(() => worldAffiliationOptions(worldNodes), [worldNodes])
  const affiliationComboboxGroups = useMemo(
    () => affiliationComboboxOptions(affiliationOptions),
    [affiliationOptions],
  )
  const filteredRoles = useMemo(
    () => filterRolesForTree(roles, filterText, worldNodes),
    [roles, filterText, worldNodes],
  )

  const selectedRole = useMemo(
    () => (selectedId ? roles.find((r) => String(r.id) === selectedId) ?? null : null),
    [roles, selectedId],
  )

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'role', {
    onCreated: (id) => {
      setSelectedId(id)
      setActiveTab('detail')
    },
  })
  const rlMutations = useEntityMutations(novelId, 'roleRelation')
  const tlMutations = useEntityMutations(novelId, 'roleTimeline')

  useEffect(() => {
    if (!selectedRole) return
    setDraftName(String(selectedRole.name ?? ''))
    setDraftFaction(String(selectedRole.faction ?? ''))
    const profile = asRecord(selectedRole.profile)
    delete profile.faction
    setDraftProfile(applyFieldDefaults(profile, detailFields))
  }, [selectedRole, detailFields])

  const treeNodes = useMemo(
    () =>
      toWorkspaceNodes(buildRoleFactionTreeData(filteredRoles, worldNodes), {
        selectedId,
        onDeleteRole: (id) => {
          deleteMutation.mutate(id)
          if (selectedId === id) setSelectedId(null)
        },
        deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
      }),
    [filteredRoles, worldNodes, selectedId, deleteMutation],
  )

  const roleOptions = useMemo(
    () =>
      roles
        .filter((r) => String(r.id) !== selectedId)
        .map((r) => ({ label: String(r.name ?? '未命名'), value: String(r.id) })),
    [roles, selectedId],
  )

  const roleNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of roles) map.set(String(r.id), String(r.name ?? '未命名'))
    return map
  }, [roles])

  function handleCreateRole() {
    const name = addName.trim()
    if (!name) {
      toast.warning('请填写人物名称')
      return
    }
    createMutation.mutate({ name, faction: addFaction.trim(), profile: {} })
    setAddOpen(false)
    setAddName('')
    setAddFaction('')
  }

  function handleSaveDetail() {
    if (!selectedId) return
    updateMutation.mutate({
      id: selectedId,
      data: { name: draftName.trim(), faction: draftFaction.trim(), profile: draftProfile },
    })
  }

  function openRlCreate() {
    setRlEditingId(null)
    setRlToRoleId('')
    setRlRelationType('')
    setRlContent('')
    setRlExtra({})
    setRlOpen(true)
  }

  function openRlEdit(rel: Record<string, unknown>) {
    setRlEditingId(String(rel.id))
    setRlToRoleId(String(rel.toRoleId ?? ''))
    setRlRelationType(String(rel.relationType ?? ''))
    setRlContent(String(rel.content ?? ''))
    setRlExtra(asRecord(rel.extra))
    setRlOpen(true)
  }

  function handleSaveRelation() {
    if (!selectedId) return
    const toRoleId = rlToRoleId.trim()
    if (!toRoleId) {
      toast.warning('请选择目标人物')
      return
    }
    if (toRoleId === selectedId) {
      toast.warning('不能建立与自身的关系')
      return
    }
    const payload = {
      relationType: rlRelationType,
      content: rlContent,
      extra: rlExtra,
    }
    if (rlEditingId) {
      rlMutations.updateMutation.mutate({ id: rlEditingId, data: payload })
    } else {
      rlMutations.createMutation.mutate({ fromRoleId: selectedId, toRoleId, ...payload })
    }
    setRlOpen(false)
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
      tlMutations.createMutation.mutate({ roleId: selectedId, ...payload })
    }
    setTlOpen(false)
  }

  if (!novelId) return <div className="text-sm text-muted">加载中…</div>

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">人物</h2>
        <p className="mt-1 text-sm text-muted">
          人物列表与详情；可归属世界势力或城市，选中后可编辑详情、关系与时间线。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={() => {
            setAddName('')
            setAddFaction('')
            setAddOpen(true)
          }}
          onClear={
            roles.length
              ? () => {
                  for (const r of roles) {
                    if (r.id) deleteMutation.mutate(String(r.id))
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
            onSelect={(key) => {
              if (!isRoleGroupKey(key)) setSelectedId(key)
            }}
            emptyText={filterText.trim() ? '无匹配人物' : '暂无人物，点击 + 添加'}
          />
        </ManageTreeSidebar>

        {selectedRole ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))} className="flex min-h-0 flex-1 flex-col">
              <Tabs.ListContainer><Tabs.List>
                <Tabs.Tab id="detail">详情</Tabs.Tab>
                <Tabs.Tab id="relation">关系</Tabs.Tab>
                <Tabs.Tab id="timeline">时间</Tabs.Tab>
              </Tabs.List></Tabs.ListContainer>

              <Tabs.Panel id="detail" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 flex flex-col gap-5 overflow-auto pr-1">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      <Label>人物名称</Label>
                      <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-3">
                      <Label>所属势力 / 城市</Label>
                      <SingleCombobox
                        value={draftFaction || '__none__'}
                        placeholder="选择世界势力或城市"
                        onValueChange={(v) => setDraftFaction(v === '__none__' ? '' : v)}
                        options={affiliationComboboxGroups}
                      />
                    </div>
                  </div>
                  {detailFields.length > 0 ? (
                    <DynamicTemplateFields
                      fields={detailFields}
                      value={draftProfile}
                      onChange={setDraftProfile}
                    />
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

              <Tabs.Panel id="relation" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex shrink-0 justify-end">
                  <Button type="button" size="sm" onPress={openRlCreate}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    添加关系
                  </Button>
                </div>
                {relationsQuery.isLoading ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted">加载中…</div>
                ) : relations.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted">暂无关系记录</div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
                    {relations.map((rel) => (
                      <div key={String(rel.id)} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                        <div className="min-w-0 flex-1 truncate text-sm font-medium">
                          {roleNameById.get(String(rel.toRoleId)) ?? '未知'}
                          {String(rel.relationType ?? '').trim() ? (
                            <span className="ml-1 font-normal text-muted">· {String(rel.relationType)}</span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-0.5">
                          <Button type="button" variant="ghost" isIconOnly className="h-8 w-8" onPress={() => openRlEdit(rel)}>
                            <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </Button>
                          <AlertDialog>
                            <AlertDialog.Trigger><Button type="button" variant="ghost" isIconOnly className="h-8 w-8 text-danger">
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                              </Button>
                            </AlertDialog.Trigger>
                            <AlertDialog.Backdrop><AlertDialog.Container><AlertDialog.Dialog className="app-no-drag">
                              <AlertDialog.Header><AlertDialog.Heading>确定删除该关系？</AlertDialog.Heading></AlertDialog.Header><AlertDialog.Body><p className="text-muted text-sm">此操作不可撤销。</p></AlertDialog.Body>
                              <AlertDialog.Footer>
                                <Button slot="close" variant="outline">取消</Button>
                                <Button slot="close" variant="danger" onPress={() => rlMutations.deleteMutation.mutate(String(rel.id))}>
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

              <Tabs.Panel id="timeline" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <p className="text-xs text-muted">按排序时间点排列</p>
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
            <User className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">选择左侧人物查看详情</p>
          </div>
        )}
      </div>

      <FormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="添加人物"
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setAddOpen(false)}>
              取消
            </Button>
            <Button type="button" onPress={handleCreateRole} isDisabled={!addName.trim() || createMutation.isPending}>
              {createMutation.isPending ? '添加中…' : '确定'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Label>人物名称</Label>
            <Input value={addName} autoFocus onChange={(e) => setAddName(e.target.value)} placeholder="输入人物名称" />
          </div>
          <div className="flex flex-col gap-3">
            <Label>所属势力 / 城市</Label>
            <SingleCombobox
              value={addFaction || '__none__'}
              placeholder="选择世界势力或城市（可选）"
              onValueChange={(v) => setAddFaction(v === '__none__' ? '' : v)}
              options={affiliationComboboxGroups}
            />
          </div>
        </div>
      </FormModal>

      <FormModal
        open={rlOpen}
        onOpenChange={setRlOpen}
        title={rlEditingId ? '编辑关系' : '添加关系'}
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setRlOpen(false)}>
              取消
            </Button>
            <Button type="button" onPress={handleSaveRelation} isDisabled={!rlToRoleId.trim() || rlMutations.createMutation.isPending || rlMutations.updateMutation.isPending}>
              确定
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Label>目标人物</Label>
            {rlEditingId ? (
              <Input value={roleNameById.get(rlToRoleId) ?? '未知'} disabled />
            ) : (
              <SingleCombobox
                value={rlToRoleId}
                placeholder="选择目标人物"
                onValueChange={setRlToRoleId}
                options={roleOptions}
              />
            )}
          </div>
          <div className="flex flex-col gap-3">
            <Label>关系类型</Label>
            <SingleCombobox
              value={rlRelationType}
              placeholder="选择关系类型"
              onValueChange={setRlRelationType}
              options={RELATION_TYPE_OPTIONS}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label>关系说明</Label>
            <TextArea value={rlContent} rows={4} onChange={(e) => setRlContent(e.target.value)} />
          </div>
          {rlTemplateFields.length > 0 ? (
            <div className={FORM_MODAL_SECTION_CLASS}>
              <p className="mb-3 text-sm font-medium">扩展字段</p>
              <DynamicTemplateFields fields={rlTemplateFields} value={rlExtra} onChange={setRlExtra} />
            </div>
          ) : null}
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
              isDisabled={!tlTimeLabel.trim() || !isValidTimePoint(tlTimePoint) || tlMutations.createMutation.isPending || tlMutations.updateMutation.isPending}
            >
              确定
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Label>时间标记</Label>
            <Input value={tlTimeLabel} autoFocus onChange={(e) => setTlTimeLabel(e.target.value)} placeholder="如：太古元年" />
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
              placeholder={tlContentField?.placeholder ?? '该时间点人物的变化…'}
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
