import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { Button, Input, Label, TextArea, TextField } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { WorkspaceTree, buildHierarchyTree } from '@/app/components/novel-workspace/workspace-tree'
import {
  DynamicTemplateFields,
  applyFieldDefaults,
} from '@/app/components/novel-workspace/dynamic-template-fields'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { FormModal, FORM_MODAL_SECTION_CLASS } from '@/app/components/novel-workspace/form-modal'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { useEntityList, useEntityMutations } from '@/app/hooks/use-entity-crud'
import { useFormTemplateFields } from '@/app/hooks/use-form-template-fields'
import { filterWorldNodesForTree } from '@/app/lib/manage-tree-filter'
import { SingleCombobox } from '@/app/components/single-combobox'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'
import { resolveParentId } from '@/app/lib/parent-ref'

type OutlineKind = 'volume' | 'chapter_segment'

const CORE_SCALAR_KEYS = new Set(['name', 'ordinal', 'chapterRange', 'chapterNo', 'volumeNo', 'content'])

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {}
}

function volumeLabel(ordinal: unknown, name: string): string {
  const n = Number(ordinal)
  return Number.isFinite(n) && n > 0 ? `第${n}卷 · ${name}` : name
}

function segmentLabel(ordinal: unknown, name: string): string {
  const n = Number(ordinal)
  return Number.isFinite(n) && n > 0 ? `第${n}章 · ${name}` : name
}

function nextVolumeOrdinal(volumes: Record<string, unknown>[]): number {
  let max = 0
  for (const v of volumes) {
    const n = Number(v.ordinal)
    if (Number.isFinite(n) && n > max) max = n
  }
  return max + 1
}

function sortOutlineNodes(nodes: Record<string, unknown>[]): Record<string, unknown>[] {
  const volumes = nodes
    .filter((n) => n.kind === 'volume')
    .sort((a, b) => Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0))
  const segments = nodes.filter((n) => n.kind === 'chapter_segment')
  const result: Record<string, unknown>[] = []
  const used = new Set<string>()

  for (const vol of volumes) {
    result.push(vol)
    used.add(String(vol.id))
    const segs = segments
      .filter((s) => resolveParentId(nodes, s.parentId) === String(vol.id))
      .sort((a, b) => Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0))
    for (const seg of segs) {
      result.push(seg)
      used.add(String(seg.id))
    }
  }
  for (const seg of segments) {
    if (!used.has(String(seg.id))) result.push(seg)
  }
  return result
}

function extraFieldsForKind(fields: FormFieldDef[]): FormFieldDef[] {
  return fields.filter((f) => !CORE_SCALAR_KEYS.has(f.key))
}

function onlyAddChildOnVolumes(
  nodes: ReturnType<typeof buildHierarchyTree>,
  selectedId: string | null,
  nodesById: Map<string, Record<string, unknown>>,
): ReturnType<typeof buildHierarchyTree> {
  return nodes.map((n) => {
    const item = nodesById.get(n.key)
    const isVolume = item?.kind === 'volume'
    return {
      ...n,
      onAddChild: isVolume && selectedId === n.key ? n.onAddChild : undefined,
      children: n.children ? onlyAddChildOnVolumes(n.children, selectedId, nodesById) : undefined,
    }
  })
}

export function NovelOutlinePage() {
  const { novelId } = useNovelRouteContext('outline')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addKind, setAddKind] = useState<OutlineKind>('volume')
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [addName, setAddName] = useState('')
  const [addOrdinal, setAddOrdinal] = useState<number | null>(null)
  const [addContent, setAddContent] = useState('')
  const [addExtra, setAddExtra] = useState<Record<string, unknown>>({})

  const [draftName, setDraftName] = useState('')
  const [draftOrdinal, setDraftOrdinal] = useState<number | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftExtra, setDraftExtra] = useState<Record<string, unknown>>({})

  const listQuery = useEntityList(novelId, 'outline')
  const { fields: volumeTemplateFields } = useFormTemplateFields(novelId, 'outline')
  const { fields: segmentTemplateFields } = useFormTemplateFields(novelId, 'outline', 'chapter')

  const nodes = (listQuery.data ?? []) as Record<string, unknown>[]
  const volumes = useMemo(() => nodes.filter((n) => n.kind === 'volume'), [nodes])

  const selectedNode = useMemo(
    () => (selectedId ? nodes.find((n) => String(n.id) === selectedId) ?? null : null),
    [nodes, selectedId],
  )

  const selectedKind = selectedNode?.kind === 'chapter_segment' ? 'chapter_segment' : 'volume'
  const activeTemplateFields = selectedKind === 'volume' ? volumeTemplateFields : segmentTemplateFields
  const activeExtraFields = useMemo(() => extraFieldsForKind(activeTemplateFields), [activeTemplateFields])

  const addTemplateFields = addKind === 'volume' ? volumeTemplateFields : segmentTemplateFields
  const addExtraFields = useMemo(() => extraFieldsForKind(addTemplateFields), [addTemplateFields])

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'outline', {
    onCreated: (id) => setSelectedId(id),
  })

  useEffect(() => {
    if (!selectedNode) return
    setDraftName(String(selectedNode.name ?? ''))
    const ord = Number(selectedNode.ordinal)
    setDraftOrdinal(Number.isFinite(ord) ? ord : null)
    setDraftContent(String(selectedNode.content ?? ''))
    setDraftExtra(applyFieldDefaults(asRecord(selectedNode.extra), activeExtraFields))
  }, [selectedNode, activeExtraFields])

  const filteredNodes = useMemo(() => filterWorldNodesForTree(nodes, filterText), [nodes, filterText])
  const nodesById = useMemo(() => new Map(nodes.map((n) => [String(n.id), n])), [nodes])

  const treeNodes = useMemo(() => {
    const sorted = sortOutlineNodes(filteredNodes)
    const built = buildHierarchyTree(sorted, (item) => {
      const name = String(item.name ?? '未命名')
      return item.kind === 'volume'
        ? volumeLabel(item.ordinal, name)
        : segmentLabel(item.ordinal, name)
    }, {
      getTooltip: (item) => {
        const name = String(item.name ?? '未命名')
        return item.kind === 'volume'
          ? volumeLabel(item.ordinal, name)
          : segmentLabel(item.ordinal, name)
      },
      onDelete: (item) => {
        deleteMutation.mutate(String(item.id))
        if (selectedId === String(item.id)) setSelectedId(null)
      },
      onAddChild: (item) => {
        if (item.kind !== 'volume') return
        openAddModal('chapter_segment', String(item.id))
      },
      deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
    })
    return onlyAddChildOnVolumes(built, selectedId, nodesById)
  }, [filteredNodes, selectedId, nodesById, deleteMutation])

  function openAddModal(kind: OutlineKind, parentId: string | null = null) {
    setAddKind(kind)
    setAddParentId(parentId)
    setAddName('')
    setAddContent('')
    setAddExtra({})
    if (kind === 'volume') {
      setAddOrdinal(nextVolumeOrdinal(volumes))
    } else {
      setAddOrdinal(null)
    }
    setAddOpen(true)
  }

  function handleCreate() {
    const name = addName.trim()
    if (addOrdinal == null || addOrdinal < 1) {
      toast.warning(addKind === 'volume' ? '请填写卷号' : '请填写章号')
      return
    }
    if (!name) {
      toast.warning(addKind === 'volume' ? '请填写卷名称' : '请填写本章标题')
      return
    }
    if (addKind === 'chapter_segment' && !addParentId) {
      toast.warning('请选择所属卷')
      return
    }
    createMutation.mutate({
      kind: addKind,
      name,
      ordinal: String(addOrdinal),
      parentId: addKind === 'chapter_segment' ? addParentId : null,
      content: addContent,
      extra: addExtra,
    })
    setAddOpen(false)
  }

  function handleSave() {
    if (!selectedId || !selectedNode) return
    if (draftOrdinal == null || draftOrdinal < 1) {
      toast.warning(selectedNode.kind === 'volume' ? '请填写卷号' : '请填写章号')
      return
    }
    if (!draftName.trim()) {
      toast.warning(selectedNode.kind === 'volume' ? '请填写卷名称' : '请填写本章标题')
      return
    }
    updateMutation.mutate({
      id: selectedId,
      data: {
        name: draftName.trim(),
        ordinal: String(draftOrdinal),
        content: draftContent,
        extra: draftExtra,
      },
    })
  }

  if (!novelId) return null

  const addParentVolume = addParentId ? volumes.find((v) => String(v.id) === addParentId) : null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">大纲</h2>
        <p className="mt-1 text-sm text-muted">
          两层大纲树：卷（volume）与单章说明（chapter_segment）。先规划卷，再在卷下添加各章说明。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={() => openAddModal('volume')}
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
            emptyText={filterText.trim() ? '无匹配节点' : '暂无大纲，点击 + 添加卷'}
          />
        </ManageTreeSidebar>

        {selectedNode ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField
                  value={draftOrdinal != null ? String(draftOrdinal) : ''}
                  onChange={(v) => {
                    const n = Number.parseInt(v, 10)
                    setDraftOrdinal(Number.isFinite(n) ? n : null)
                  }}
                  className="space-y-2"
                >
                  <Label>{selectedKind === 'volume' ? '卷号' : '章号'}</Label>
                  <Input type="number" min={1} step={1} />
                </TextField>
                <TextField value={draftName} onChange={setDraftName} className="space-y-2">
                  <Label>{selectedKind === 'volume' ? '卷名称' : '本章标题'}</Label>
                  <Input />
                </TextField>
              </div>
              <TextField value={draftContent} onChange={setDraftContent} className="space-y-2">
                <Label>内容要点</Label>
                <TextArea
                  rows={6}
                  placeholder={
                    selectedKind === 'volume'
                      ? '本卷整体走向、核心矛盾、与前后卷的衔接…'
                      : '本章情节推进、人物变化与伏笔…'
                  }
                />
              </TextField>
              {activeExtraFields.length > 0 ? (
                <div className={FORM_MODAL_SECTION_CLASS}>
                  <p className="mb-3 text-sm font-medium">扩展字段</p>
                  <DynamicTemplateFields fields={activeExtraFields} value={draftExtra} onChange={setDraftExtra} />
                </div>
              ) : null}
            </div>
            <DetailSaveFooter
              onSave={handleSave}
              saving={updateMutation.isPending}
              disabled={draftOrdinal == null || draftOrdinal < 1 || !draftName.trim()}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <FileText className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">选择左侧卷或单章说明查看详情</p>
          </div>
        )}
      </div>

      <FormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title={
          addKind === 'volume'
            ? '添加卷'
            : addParentVolume
              ? `添加单章说明 · ${volumeLabel(addParentVolume.ordinal, String(addParentVolume.name ?? ''))}`
              : '添加单章说明'
        }
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setAddOpen(false)}>
              取消
            </Button>
            <Button type="button" onPress={handleCreate} isDisabled={createMutation.isPending || !addName.trim()}>
              {createMutation.isPending ? '添加中…' : '确定'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3">
            <Label>节点类型</Label>
            <SingleCombobox
              value={addKind}
              onValueChange={(v) => {
                const kind = v as OutlineKind
                setAddKind(kind)
                if (kind === 'volume') {
                  setAddParentId(null)
                  setAddOrdinal(nextVolumeOrdinal(volumes))
                } else {
                  setAddOrdinal(null)
                }
              }}
              options={[
                { value: 'volume', label: '卷' },
                { value: 'chapter_segment', label: '单章说明' },
              ]}
            />
          </div>
          {addKind === 'chapter_segment' ? (
            <div className="flex flex-col gap-3">
              <Label>所属卷</Label>
              <SingleCombobox
                value={addParentId ?? ''}
                placeholder="选择所属卷"
                onValueChange={setAddParentId}
                options={volumes.map((v) => ({
                  value: String(v.id),
                  label: volumeLabel(v.ordinal, String(v.name ?? '未命名')),
                }))}
              />
            </div>
          ) : null}
          <TextField
            value={addOrdinal != null ? String(addOrdinal) : ''}
            onChange={(v) => {
              const n = Number.parseInt(v, 10)
              setAddOrdinal(Number.isFinite(n) ? n : null)
            }}
            className="flex flex-col gap-3"
          >
            <Label>{addKind === 'volume' ? '卷号' : '章号'}</Label>
            <Input type="number" min={1} step={1} autoFocus />
          </TextField>
          <TextField value={addName} onChange={setAddName} className="space-y-2">
            <Label>{addKind === 'volume' ? '卷名称' : '本章标题'}</Label>
            <Input />
          </TextField>
          <TextField value={addContent} onChange={setAddContent} className="space-y-2">
            <Label>内容要点</Label>
            <TextArea rows={4} />
          </TextField>
          {addExtraFields.length > 0 ? (
            <div className={FORM_MODAL_SECTION_CLASS}>
              <p className="mb-3 text-sm font-medium">扩展字段</p>
              <DynamicTemplateFields fields={addExtraFields} value={addExtra} onChange={setAddExtra} />
            </div>
          ) : null}
        </div>
      </FormModal>
    </div>
  )
}
