import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Folder, Plus, RefreshCw } from 'lucide-react'
import { AlertDialog, Button, Input, Label, TextArea } from '@heroui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/app/lib/toast'
import { FormModal } from '@/app/components/novel-workspace/form-modal'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { WorkspaceTree, type WorkspaceTreeNode } from '@/app/components/novel-workspace/workspace-tree'
import { SegmentedControl } from '@/app/components/segmented-control'
import { SingleCombobox } from '@/app/components/single-combobox'
import { useEntityList, useEntityMutations } from '@/app/hooks/use-entity-crud'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { simpleMarkdownToHtml } from '@/app/lib/simple-markdown'
import { resolveParentId } from '@/app/lib/parent-ref'
import { cn } from '@/app/lib/utils'

type SkillAgentKind = 'write' | 'review'
type SkillSectionKey =
  | 'overview'
  | 'role'
  | 'creature'
  | 'level'
  | 'world'
  | 'timeline'
  | 'outline'
  | 'chapters'
  | 'item'

type SkillRow = {
  id: string
  title: string
  skillType: 'directory' | 'skill'
  parentId?: string | null
  content?: string
  section: SkillSectionKey
  agentKind: SkillAgentKind
}

const SECTION_ORDER: SkillSectionKey[] = [
  'overview',
  'role',
  'creature',
  'level',
  'world',
  'timeline',
  'outline',
  'chapters',
  'item',
]

const SECTION_LABELS: Record<SkillSectionKey, string> = {
  overview: '概述',
  role: '人物',
  creature: '生物',
  level: '等级',
  world: '世界',
  timeline: '时间线',
  outline: '大纲',
  chapters: '章节',
  item: '物品',
}

function sortSkillNodes(items: SkillRow[]): SkillRow[] {
  return [...items].sort((a, b) => {
    if (a.skillType !== b.skillType) return a.skillType === 'directory' ? -1 : 1
    return a.title.localeCompare(b.title, 'zh-CN')
  })
}

function buildSectionTree(sectionSkills: SkillRow[], parentId: string | null): WorkspaceTreeNode[] {
  return sortSkillNodes(
    sectionSkills.filter((s) => resolveParentId(sectionSkills, s.parentId) === parentId),
  ).map(
    (skill) => {
      const children =
        skill.skillType === 'directory' ? buildSectionTree(sectionSkills, skill.id) : undefined
      return {
        key: skill.id,
        label: (
          <span className="flex min-w-0 items-center gap-1.5">
            {skill.skillType === 'directory' ? (
              <Folder className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.5} />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted" strokeWidth={1.5} />
            )}
            <span className="truncate">{skill.title}</span>
          </span>
        ),
        tooltip: skill.title,
        selectable: true,
        children: children && children.length > 0 ? children : undefined,
      }
    },
  )
}

function buildSkillTree(skills: SkillRow[]): WorkspaceTreeNode[] {
  const sectionMap = new Map<SkillSectionKey, SkillRow[]>()
  for (const skill of skills) {
    const section = skill.section as SkillSectionKey
    const list = sectionMap.get(section) ?? []
    list.push(skill)
    sectionMap.set(section, list)
  }

  return SECTION_ORDER.map((section) => {
    const nodes = sectionMap.get(section) ?? []
    const children = buildSectionTree(nodes, null)
    if (children.length === 0) {
      children.push({ key: `empty-${section}`, label: '（暂无）', selectable: false })
    }
    return {
      key: `section-${section}`,
      label: `${SECTION_LABELS[section]} (${nodes.length})`,
      selectable: false,
      children,
    }
  })
}

export function NovelSkillsPage() {
  const { novelId } = useNovelRouteContext('skills')
  const queryClient = useQueryClient()
  const contentRef = useRef('')

  const [agentKind, setAgentKind] = useState<SkillAgentKind>('write')
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null)
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
  const [editContent, setEditContent] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newSection, setNewSection] = useState<SkillSectionKey>('overview')
  const [newSkillType, setNewSkillType] = useState<'directory' | 'skill'>('skill')
  const [newParentId, setNewParentId] = useState<string>('')

  const skillFilter = useMemo(() => ({ where: { agentKind } }), [agentKind])

  const skillsQuery = useEntityList(novelId, 'skill', skillFilter)

  const skills = useMemo(
    () =>
      (skillsQuery.data ?? []).map((row) => ({
        id: String(row.id),
        title: String(row.title ?? ''),
        skillType: (row.skillType === 'directory' ? 'directory' : 'skill') as 'directory' | 'skill',
        parentId: row.parentId != null ? String(row.parentId) : null,
        content: typeof row.content === 'string' ? row.content : '',
        section: String(row.section ?? 'overview') as SkillSectionKey,
        agentKind: (row.agentKind === 'review' ? 'review' : 'write') as SkillAgentKind,
      })),
    [skillsQuery.data],
  )

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'skill', {
    filter: skillFilter,
    onCreated: (id) => setSelectedSkillId(id),
  })

  const resetMutation = useMutation({
    mutationFn: () => window.ipcApi.skill.resetDefaults({ novelId: novelId! }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['entity', novelId, 'skill'] })
      setSelectedSkillId(null)
      toast.success(`已还原为默认技能（${result.skills.length} 个）`)
    },
    onError: (e: Error) => toast.error(e.message || '还原失败'),
  })

  const initDefaultsAttempted = useRef<string | null>(null)

  useEffect(() => {
    if (!novelId || initDefaultsAttempted.current === novelId) return
    initDefaultsAttempted.current = novelId
    void window.ipcApi.skill
      .initDefaults({ novelId })
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['entity', novelId, 'skill'] })
      })
      .catch(() => {})
  }, [novelId, queryClient])

  useEffect(() => {
    setSelectedSkillId(null)
  }, [novelId, agentKind])

  useEffect(() => {
    if (skills.length === 0) {
      setSelectedSkillId(null)
      return
    }
    setSelectedSkillId((prev) => {
      if (prev && skills.some((s) => s.id === prev)) return prev
      return skills[0]?.id ?? null
    })
  }, [skills])

  const selectedSkill = useMemo(
    () => skills.find((s) => s.id === selectedSkillId) ?? null,
    [skills, selectedSkillId],
  )

  useEffect(() => {
    const content = selectedSkill?.content ?? ''
    setEditContent(content)
    contentRef.current = content
  }, [selectedSkillId, selectedSkill?.content])

  const treeNodes = useMemo(() => buildSkillTree(skills), [skills])

  const directoryOptions = useMemo(
    () =>
      skills.filter(
        (s) => s.skillType === 'directory' && s.section === newSection && s.agentKind === agentKind,
      ),
    [skills, newSection, agentKind],
  )

  const hasChanges = Boolean(selectedSkill && contentRef.current !== (selectedSkill.content ?? ''))

  const handleTreeSelect = useCallback((key: string) => {
    if (key.startsWith('section-') || key.startsWith('empty-')) return
    setSelectedSkillId(key)
  }, [])

  const handleContentChange = useCallback((value: string) => {
    contentRef.current = value
    setEditContent(value)
  }, [])

  const handleSave = useCallback(() => {
    if (!selectedSkillId) return
    updateMutation.mutate({ id: selectedSkillId, data: { content: contentRef.current } })
  }, [selectedSkillId, updateMutation])

  const handleCreate = useCallback(() => {
    const title = newTitle.trim()
    if (!title) {
      toast.warning('请输入标题')
      return
    }
    createMutation.mutate(
      {
        title,
        section: newSection,
        skillType: newSkillType,
        agentKind,
        parentId: newSkillType === 'skill' && newParentId ? newParentId : null,
        content: '',
      },
      {
        onSuccess: () => {
          setCreateOpen(false)
          setNewTitle('')
          setNewParentId('')
        },
      },
    )
  }, [newTitle, newSection, newSkillType, newParentId, agentKind, createMutation])

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id, {
        onSuccess: () => {
          if (selectedSkillId === id) setSelectedSkillId(null)
        },
      })
    },
    [deleteMutation, selectedSkillId],
  )

  if (!novelId) return <div />

  return (
    <div className="flex h-full min-h-0 min-w-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-default/20">
        <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border px-2 py-2">
          <SegmentedControl
            size="sm"
            className="min-w-0 flex-1"
            value={agentKind}
            onChange={setAgentKind}
            options={[
              { value: 'write', label: '写作' },
              { value: 'review', label: '审查' },
            ]}
          />
          <AlertDialog>
            <AlertDialog.Trigger><Button
                type="button"
                variant="ghost"
                isIconOnly
                className="h-8 w-8 shrink-0"
                aria-label="还原默认技能"
                isDisabled={resetMutation.isPending}
              >
                <RefreshCw className={cn('h-4 w-4', resetMutation.isPending && 'animate-spin')} strokeWidth={1.5} />
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Backdrop><AlertDialog.Container><AlertDialog.Dialog className="app-no-drag">
              <AlertDialog.Header><AlertDialog.Heading>还原为默认技能？</AlertDialog.Heading></AlertDialog.Header><AlertDialog.Body><p className="text-muted text-sm">
                  将删除本书全部技能（含自定义），并恢复为默认技能库，不可撤销。
                </p></AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="outline">
                  取消
                </Button>
                <Button slot="close" variant="danger" onPress={() => void resetMutation.mutate()}>
                  还原
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog></AlertDialog.Container></AlertDialog.Backdrop>
          </AlertDialog>
          <Button
            type="button"
            variant="ghost"
            isIconOnly
            className="h-8 w-8 shrink-0"
            aria-label="添加技能"
            onPress={() => {
              setNewSection(selectedSkill?.section ?? 'overview')
              setNewSkillType('skill')
              setNewParentId(selectedSkill?.skillType === 'directory' ? selectedSkill.id : '')
              setCreateOpen(true)
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-1 py-1">
          {skillsQuery.isLoading ? (
            <p className="px-2 py-4 text-center text-xs text-muted">加载中…</p>
          ) : (
            <WorkspaceTree
              nodes={treeNodes.map((sectionNode) => ({
                ...sectionNode,
                children: sectionNode.children?.map((node) => enrichTreeNode(node, handleDelete, deleteMutation.isPending)),
              }))}
              selectedKey={selectedSkillId}
              onSelect={handleTreeSelect}
              emptyText="暂无技能，请新增"
            />
          )}
        </div>
      </aside>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex h-8 shrink-0 items-center border-b border-border px-3 py-2">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'edit', label: '编辑' },
              { value: 'preview', label: '预览' },
            ]}
          />
        </div>

        {selectedSkill ? (
          selectedSkill.skillType === 'directory' ? (
            <div className="flex min-h-0 flex-1 items-center justify-center px-4">
              <p className="text-sm text-muted">此目录暂无可编辑内容，可在此目录下新增技能或子目录。</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="relative min-h-0 flex-1 overflow-hidden px-4 py-3">
                <TextArea
                  value={editContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  placeholder="在此输入 Markdown 内容…"
                  className={cn(
                    'absolute inset-3 resize-none font-mono transition-opacity duration-200',
                    mode === 'edit' ? 'z-10 opacity-100' : 'pointer-events-none opacity-0',
                  )}
                />
                <div
                  className={cn(
                    'absolute inset-3 overflow-auto rounded-md border border-border bg-background p-3 transition-opacity duration-200',
                    mode === 'preview' ? 'z-10 opacity-100' : 'pointer-events-none opacity-0',
                  )}
                >
                  {editContent.trim() ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(editContent) }}
                    />
                  ) : (
                    <p className="text-sm text-muted">暂无内容</p>
                  )}
                </div>
              </div>
              {mode === 'edit' ? (
                <DetailSaveFooter
                  onSave={handleSave}
                  saving={updateMutation.isPending}
                  disabled={!hasChanges}
                />
              ) : null}
            </div>
          )
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center px-4">
            <p className="text-sm text-muted">
              {skills.length === 0 ? '请点击左上角「+」新增技能' : '请从左侧树中选择一个技能'}
            </p>
          </div>
        )}
      </div>

      <FormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新增技能"
        footer={
          <>
            <Button variant="outline" onPress={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button isDisabled={createMutation.isPending} onPress={handleCreate}>
              {createMutation.isPending ? '创建中…' : '创建'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Label>标题</Label>
            <Input
              value={newTitle}
              placeholder="例如：反派塑造技巧"
              autoFocus
              onChange={(e) => setNewTitle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label>适用目录</Label>
            <SingleCombobox
              value={newSection}
              onValueChange={(v) => setNewSection(v as SkillSectionKey)}
              options={SECTION_ORDER.map((sec) => ({
                value: sec,
                label: SECTION_LABELS[sec],
              }))}
            />
          </div>
          <div className="flex flex-col gap-3">
            <Label>类型</Label>
            <SingleCombobox
              value={newSkillType}
              onValueChange={(v) => setNewSkillType(v as 'directory' | 'skill')}
              options={[
                { value: 'skill', label: '技能' },
                { value: 'directory', label: '目录' },
              ]}
            />
          </div>
          {newSkillType === 'skill' ? (
            <div className="flex flex-col gap-3">
              <Label>上级目录</Label>
              <SingleCombobox
                value={newParentId || '__none__'}
                placeholder="无（顶级）"
                onValueChange={(v) => setNewParentId(v === '__none__' ? '' : v)}
                options={[
                  { value: '__none__', label: '无（顶级）' },
                  ...directoryOptions.map((dir) => ({ value: dir.id, label: dir.title })),
                ]}
              />
            </div>
          ) : null}
        </div>
      </FormModal>
    </div>
  )
}

function enrichTreeNode(
  node: WorkspaceTreeNode,
  onDelete: (id: string) => void,
  deleteLoading: boolean,
): WorkspaceTreeNode {
  if (node.key.startsWith('empty-') || node.key.startsWith('section-')) return node
  return {
    ...node,
    onDelete: () => onDelete(node.key),
    deleteLoading,
    children: node.children?.map((child) => enrichTreeNode(child, onDelete, deleteLoading)),
  }
}
