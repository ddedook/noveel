import { useEffect, useMemo, useState } from 'react'
import { Clock } from 'lucide-react'
import { Button, Input, Label, Switch, TextArea } from '@heroui/react'
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

const TIMELINE_EVENT_TYPE_LABELS: Record<string, string> = {
  plot: '主线推进',
  conflict: '冲突',
  suspense: '悬念',
  foreshadow: '伏笔',
  turning: '转折',
  resolution: '收束/解决',
  other: '其他',
}

const TIMELINE_EVENT_TYPES = Object.keys(TIMELINE_EVENT_TYPE_LABELS)
const TIMELINE_EVENT_TYPE_OPTIONS = TIMELINE_EVENT_TYPES.map((t) => ({
  label: TIMELINE_EVENT_TYPE_LABELS[t],
  value: t,
}))
const TIMELINE_RESOLVABLE_EVENT_TYPES = new Set(['conflict', 'suspense', 'foreshadow'])

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

function extraFieldsExcludingContent(fields: FormFieldDef[]): FormFieldDef[] {
  return fields.filter((f) => f.key !== 'content')
}

export function NovelTimelinePage() {
  const { novelId } = useNovelRouteContext('timeline')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterText, setFilterText] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [addTimeLabel, setAddTimeLabel] = useState('')
  const [addTimePoint, setAddTimePoint] = useState<number | null>(null)
  const [addTitle, setAddTitle] = useState('')
  const [addContent, setAddContent] = useState('')
  const [addEventType, setAddEventType] = useState('plot')
  const [addIsResolved, setAddIsResolved] = useState(false)
  const [addRelatedChapterId, setAddRelatedChapterId] = useState<string | undefined>()
  const [addResolveChapterId, setAddResolveChapterId] = useState<string | undefined>()
  const [addExtra, setAddExtra] = useState<Record<string, unknown>>({})

  const [draftTimeLabel, setDraftTimeLabel] = useState('')
  const [draftTimePoint, setDraftTimePoint] = useState<number | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [draftEventType, setDraftEventType] = useState('plot')
  const [draftIsResolved, setDraftIsResolved] = useState(false)
  const [draftRelatedChapterId, setDraftRelatedChapterId] = useState<string | undefined>()
  const [draftResolveChapterId, setDraftResolveChapterId] = useState<string | undefined>()
  const [draftExtra, setDraftExtra] = useState<Record<string, unknown>>({})

  const listQuery = useEntityList(novelId, 'timeline')
  const chaptersQuery = useEntityList(novelId, 'chapter')
  const { fields: templateFields } = useFormTemplateFields(novelId, 'timeline')
  const extraFields = useMemo(() => extraFieldsExcludingContent(templateFields), [templateFields])

  const events = useMemo(() => {
    const rows = (listQuery.data ?? []) as Record<string, unknown>[]
    return [...rows].sort((a, b) => Number(a.timePoint ?? 0) - Number(b.timePoint ?? 0))
  }, [listQuery.data])

  const chapters = (chaptersQuery.data ?? []) as Record<string, unknown>[]
  const chapterOptions = useMemo(() => buildChapterSelectOptions(chapters), [chapters])

  const filteredEvents = useMemo(
    () =>
      filterFlatList(events, filterText, (ev) =>
        `${String(ev.timeLabel ?? '')} ${String(ev.timePoint ?? '')} ${String(ev.title ?? '')} ${TIMELINE_EVENT_TYPE_LABELS[String(ev.eventType ?? '')] ?? ''}`,
      ),
    [events, filterText],
  )

  const selectedEvent = useMemo(
    () => (selectedId ? events.find((e) => String(e.id) === selectedId) ?? null : null),
    [events, selectedId],
  )

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'timeline', {
    onCreated: (id) => setSelectedId(id),
  })

  const treeNodes = useMemo(
    () =>
      buildFlatTree(filteredEvents, (ev) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-1">
            <span className="font-medium">{String(ev.timeLabel ?? '')}</span>
            <span className="ml-1 text-xs text-muted">({String(ev.timePoint ?? '')})</span>
          </span>
          <span className="line-clamp-1 text-xs text-muted">
            {String(ev.title ?? '').trim() ? `${String(ev.title).trim()} · ` : ''}
            {TIMELINE_EVENT_TYPE_LABELS[String(ev.eventType ?? '')] ?? String(ev.eventType ?? '')}
          </span>
        </span>
      ), {
        getTooltip: (ev) =>
          `${String(ev.timeLabel ?? '')} (${String(ev.timePoint ?? '')}) ${String(ev.title ?? '').trim()}`.trim(),
        onDelete: (ev) => {
          const id = String(ev.id)
          deleteMutation.mutate(id)
          if (selectedId === id) setSelectedId(null)
        },
        deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
      }),
    [filteredEvents, deleteMutation, selectedId],
  )

  useEffect(() => {
    if (!selectedEvent) return
    setDraftTimeLabel(String(selectedEvent.timeLabel ?? ''))
    setDraftTimePoint(typeof selectedEvent.timePoint === 'number' ? selectedEvent.timePoint : Number(selectedEvent.timePoint) || null)
    setDraftTitle(String(selectedEvent.title ?? ''))
    setDraftContent(String(selectedEvent.content ?? ''))
    setDraftEventType(String(selectedEvent.eventType ?? 'plot'))
    setDraftIsResolved(Boolean(selectedEvent.isResolved))
    setDraftRelatedChapterId(chapterRefToSelectValue(selectedEvent.relatedChapterNo, chapters))
    setDraftResolveChapterId(chapterRefToSelectValue(selectedEvent.resolveChapterNo, chapters))
    setDraftExtra(applyFieldDefaults(asRecord(selectedEvent.extra), extraFields))
  }, [selectedEvent, chapters, extraFields])

  function resetAddForm() {
    setAddTimeLabel('')
    setAddTimePoint(null)
    setAddTitle('')
    setAddContent('')
    setAddEventType('plot')
    setAddIsResolved(false)
    setAddRelatedChapterId(undefined)
    setAddResolveChapterId(undefined)
    setAddExtra({})
  }

  function handleCreate() {
    const timeLabel = addTimeLabel.trim()
    if (!timeLabel) {
      toast.warning('请填写时间标记')
      return
    }
    if (!isValidTimePoint(addTimePoint)) {
      toast.warning('请填写有效的排序时间点（整数）')
      return
    }
    createMutation.mutate({
      timeLabel,
      timePoint: addTimePoint,
      title: addTitle,
      content: addContent,
      eventType: addEventType,
      isResolved: addIsResolved,
      relatedChapterNo: addRelatedChapterId ?? null,
      resolveChapterNo: addResolveChapterId ?? null,
      extra: addExtra,
    })
    setAddOpen(false)
    resetAddForm()
  }

  function handleSave() {
    if (!selectedId) return
    const timeLabel = draftTimeLabel.trim()
    if (!timeLabel) {
      toast.warning('请填写时间标记')
      return
    }
    if (!isValidTimePoint(draftTimePoint)) {
      toast.warning('请填写有效的排序时间点（整数）')
      return
    }
    updateMutation.mutate({
      id: selectedId,
      data: {
        timeLabel,
        timePoint: draftTimePoint,
        title: draftTitle,
        content: draftContent,
        eventType: draftEventType,
        isResolved: draftIsResolved,
        relatedChapterNo: draftRelatedChapterId ?? null,
        resolveChapterNo: draftResolveChapterId ?? null,
        extra: draftExtra,
      },
    })
  }

  if (!novelId) return null

  const draftResolvable = TIMELINE_RESOLVABLE_EVENT_TYPES.has(draftEventType)
  const addResolvable = TIMELINE_RESOLVABLE_EVENT_TYPES.has(addEventType)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">时间线</h2>
        <p className="mt-1 text-sm text-muted">
          全书主线事件、冲突、悬念与伏笔；左侧按排序时间点排列。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={() => {
            resetAddForm()
            setAddOpen(true)
          }}
          onClear={
            events.length
              ? () => {
                  for (const ev of events) {
                    if (ev.id) deleteMutation.mutate(String(ev.id))
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
            emptyText={filterText.trim() ? '无匹配事件' : '暂无事件，点击 + 创建'}
          />
        </ManageTreeSidebar>

        {selectedEvent ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 flex flex-col gap-5 overflow-auto pr-1">
              <div className="flex flex-col gap-3">
                <Label>时间标记</Label>
                <Input value={draftTimeLabel} onChange={(e) => setDraftTimeLabel(e.target.value)} />
              </div>
              <TimelineTimePointField value={draftTimePoint} onChange={setDraftTimePoint} />
              <div className="flex flex-col gap-3">
                <Label>事件标题</Label>
                <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <Label>事件类型</Label>
                  <SingleCombobox
                    value={draftEventType}
                    onValueChange={setDraftEventType}
                    options={TIMELINE_EVENT_TYPE_OPTIONS}
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <Label>触发章节</Label>
                  <SingleCombobox
                    value={draftRelatedChapterId ?? ''}
                    placeholder="选择关联章节（可选）"
                    onValueChange={setDraftRelatedChapterId}
                    options={chapterOptions}
                  />
                </div>
              </div>
              {draftResolvable ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                    <Switch isSelected={draftIsResolved} onChange={setDraftIsResolved}><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
                    <Label className="mb-0">是否已收束</Label>
                  </div>
                  <div className="flex flex-col gap-3">
                    <Label>收束章节</Label>
                    <SingleCombobox
                      value={draftResolveChapterId ?? ''}
                      placeholder="选择收束章节（可选）"
                      onValueChange={setDraftResolveChapterId}
                      options={chapterOptions}
                    />
                  </div>
                </div>
              ) : null}
              <div className="flex flex-col gap-3">
                <Label>事件内容</Label>
                <TextArea value={draftContent} rows={6} onChange={(e) => setDraftContent(e.target.value)} />
              </div>
              {extraFields.length > 0 ? (
                <div className={FORM_MODAL_SECTION_CLASS}>
                  <p className="mb-3 text-sm font-medium">扩展字段</p>
                  <DynamicTemplateFields fields={extraFields} value={draftExtra} onChange={setDraftExtra} />
                </div>
              ) : null}
            </div>
            <DetailSaveFooter
              onSave={handleSave}
              saving={updateMutation.isPending}
              disabled={!draftTimeLabel.trim() || !isValidTimePoint(draftTimePoint)}
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <Clock className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">选择左侧事件查看详情</p>
          </div>
        )}
      </div>

      <FormModal
        open={addOpen}
        onOpenChange={setAddOpen}
        title="添加时间节点"
        footer={
          <>
            <Button type="button" variant="outline" onPress={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              onPress={handleCreate}
              isDisabled={!addTimeLabel.trim() || !isValidTimePoint(addTimePoint) || createMutation.isPending}
            >
              {createMutation.isPending ? '添加中…' : '确定'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <Label>时间标记</Label>
            <Input value={addTimeLabel} autoFocus onChange={(e) => setAddTimeLabel(e.target.value)} />
          </div>
          <TimelineTimePointField value={addTimePoint} onChange={setAddTimePoint} />
          <div className="flex flex-col gap-3">
            <Label>事件标题（可选）</Label>
            <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <Label>事件类型</Label>
              <SingleCombobox
                value={addEventType}
                onValueChange={setAddEventType}
                options={TIMELINE_EVENT_TYPE_OPTIONS}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Label>触发章节</Label>
              <SingleCombobox
                value={addRelatedChapterId ?? ''}
                placeholder="选择关联章节（可选）"
                onValueChange={setAddRelatedChapterId}
                options={chapterOptions}
              />
            </div>
          </div>
          {addResolvable ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <Switch isSelected={addIsResolved} onChange={setAddIsResolved}><Switch.Control><Switch.Thumb /></Switch.Control></Switch>
                <Label className="mb-0">是否已收束</Label>
              </div>
              <div className="flex flex-col gap-3">
                <Label>收束章节</Label>
                <SingleCombobox
                  value={addResolveChapterId ?? ''}
                  placeholder="选择收束章节（可选）"
                  onValueChange={setAddResolveChapterId}
                  options={chapterOptions}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            <Label>事件内容</Label>
            <TextArea value={addContent} rows={4} onChange={(e) => setAddContent(e.target.value)} />
          </div>
          {extraFields.length > 0 ? (
            <div className={FORM_MODAL_SECTION_CLASS}>
              <p className="mb-3 text-sm font-medium">扩展字段</p>
              <DynamicTemplateFields fields={extraFields} value={addExtra} onChange={setAddExtra} />
            </div>
          ) : null}
        </div>
      </FormModal>
    </div>
  )
}
