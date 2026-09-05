import { useEffect, useMemo, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { Button, Disclosure, Input, Label, Tabs, TextArea, TextField } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { ManageTreeSidebar } from '@/app/components/novel-workspace/manage-tree-sidebar'
import { WorkspaceTree, buildFlatTree } from '@/app/components/novel-workspace/workspace-tree'
import {
  DynamicTemplateFields,
  applyFieldDefaults,
} from '@/app/components/novel-workspace/dynamic-template-fields'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { useEntityList, useEntityMutations } from '@/app/hooks/use-entity-crud'
import { useFormTemplateFields } from '@/app/hooks/use-form-template-fields'
import { filterFlatList } from '@/app/lib/manage-tree-filter'
import { getByPath } from '@/app/lib/form-path'
import type { FormFieldDef } from '@/lib/ipc/schemas/form-template-schema'

type LevelTier = Record<string, unknown> & {
  name?: string
  subLevels?: Array<{ name?: string } | string>
}

type LevelSystem = Record<string, unknown> & {
  name?: string
  category?: string
  description?: string
  levels?: LevelTier[]
}

const DEFAULT_LEVEL_FIELDS: FormFieldDef[] = [
  { key: 'name', label: '等级名称', component: 'input' },
  { key: 'subLevels', label: '细分等级', component: 'tagInput', allowCreate: true },
  { key: 'promotionCondition', label: '晋升条件', component: 'textarea', rows: 4 },
  { key: 'abilities', label: '本级典型能力', component: 'textarea', rows: 4 },
  { key: 'lifespan', label: '寿元 / 时限（可选）', component: 'input' },
]

function emptyLevelSystem(): LevelSystem {
  return {
    name: '自定义体系',
    category: '自定义',
    description: '',
    levels: [
      {
        name: '第一阶',
        subLevels: [{ name: '初期' }, { name: '中期' }, { name: '后期' }],
        promotionCondition: '',
        abilities: '',
      },
    ],
  }
}

function asSystem(raw: unknown): LevelSystem {
  if (!raw || typeof raw !== 'object') return emptyLevelSystem()
  const s = { ...(raw as LevelSystem) }
  if (!Array.isArray(s.levels) || s.levels.length === 0) {
    s.levels = emptyLevelSystem().levels!
  }
  return s
}

function levelToFormValues(lv: LevelTier, fields: FormFieldDef[]): Record<string, unknown> {
  const subRaw = lv.subLevels ?? []
  const subNames = subRaw.map((s) => (typeof s === 'string' ? s : String(s?.name ?? ''))).filter(Boolean)
  return applyFieldDefaults({ ...lv, subLevels: subNames }, fields)
}

function formValuesToLevel(vals: Record<string, unknown>, fallback: LevelTier): LevelTier {
  const sub = getByPath(vals, 'subLevels')
  const subNames = Array.isArray(sub) ? sub.map((x) => String(x).trim()).filter(Boolean) : []
  return {
    ...fallback,
    name: String(getByPath(vals, 'name') ?? fallback.name ?? ''),
    promotionCondition: String(getByPath(vals, 'promotionCondition') ?? fallback.promotionCondition ?? ''),
    abilities: String(getByPath(vals, 'abilities') ?? fallback.abilities ?? ''),
    lifespan: String(getByPath(vals, 'lifespan') ?? fallback.lifespan ?? ''),
    subLevels: subNames.map((name) => ({ name })),
  }
}

export function NovelLevelPage() {
  const { novelId } = useNovelRouteContext('level')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('detail')
  const [filterText, setFilterText] = useState('')
  const [draftSystem, setDraftSystem] = useState<LevelSystem>(emptyLevelSystem())

  const listQuery = useEntityList(novelId, 'level')
  const { fields: levelFieldsRaw } = useFormTemplateFields(novelId, 'level')
  const levelFields = levelFieldsRaw.length > 0 ? levelFieldsRaw : DEFAULT_LEVEL_FIELDS

  const systems = (listQuery.data ?? []) as Record<string, unknown>[]
  const filteredSystems = useMemo(
    () =>
      filterFlatList(systems, filterText, (item) => {
        const sys = asSystem(item.system)
        return `${String(sys.name ?? '')} ${String(sys.category ?? '')}`
      }),
    [systems, filterText],
  )

  const selectedSystem = useMemo(
    () => (selectedId ? systems.find((s) => String(s.id) === selectedId) ?? null : null),
    [systems, selectedId],
  )

  const { createMutation, updateMutation, deleteMutation } = useEntityMutations(novelId, 'level', {
    onCreated: (id) => {
      setSelectedId(id)
      setActiveTab('detail')
    },
  })

  const treeNodes = useMemo(
    () =>
      buildFlatTree(filteredSystems, (item) => {
        const sys = asSystem(item.system)
        return String(sys.name ?? '未命名')
      }, {
        getTooltip: (item) => String(asSystem(item.system).name ?? '未命名'),
        onDelete: (item) => {
          const id = String(item.id)
          deleteMutation.mutate(id)
          if (selectedId === id) setSelectedId(null)
        },
        deleteLoadingId: deleteMutation.isPending ? String(deleteMutation.variables) : null,
      }),
    [filteredSystems, deleteMutation, selectedId],
  )

  useEffect(() => {
    if (!selectedSystem) return
    setDraftSystem(asSystem(selectedSystem.system))
  }, [selectedSystem])

  function handleCreate() {
    createMutation.mutate({ system: emptyLevelSystem() })
  }

  function handleSave() {
    if (!selectedId) return
    const name = String(draftSystem.name ?? '').trim()
    if (!name) {
      toast.warning('请填写体系名称')
      return
    }
    updateMutation.mutate({
      id: selectedId,
      data: {
        system: {
          ...draftSystem,
          name,
          levels: (draftSystem.levels ?? []).filter((lv) => String(lv.name ?? '').trim()),
        },
      },
    })
  }

  function updateLevel(index: number, patch: Partial<LevelTier>) {
    setDraftSystem((prev) => ({
      ...prev,
      levels: (prev.levels ?? []).map((lv, i) => (i === index ? { ...lv, ...patch } : lv)),
    }))
  }

  function removeLevel(index: number) {
    setDraftSystem((prev) => ({
      ...prev,
      levels: (prev.levels ?? []).filter((_, i) => i !== index),
    }))
  }

  function addLevel() {
    setDraftSystem((prev) => ({
      ...prev,
      levels: [
        ...(prev.levels ?? []),
        {
          name: `第 ${(prev.levels?.length ?? 0) + 1} 阶`,
          subLevels: [{ name: '初期' }, { name: '中期' }, { name: '后期' }],
          promotionCondition: '',
          abilities: '',
        },
      ],
    }))
  }

  if (!novelId) return null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold">等级</h2>
        <p className="mt-1 text-sm text-muted">
          管理本书的等级体系：体系详情与等级阶梯分开编辑，单级字段由模板 level.levelFields 定义。
        </p>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ManageTreeSidebar
          onAdd={handleCreate}
          onClear={
            systems.length
              ? () => {
                  for (const s of systems) {
                    if (s.id) deleteMutation.mutate(String(s.id))
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
            emptyText={filterText.trim() ? '无匹配体系' : '暂无等级体系，点击 + 创建'}
          />
        </ManageTreeSidebar>

        {selectedSystem ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <Tabs selectedKey={activeTab} onSelectionChange={(key) => setActiveTab(String(key))} className="flex min-h-0 flex-1 flex-col">
              <Tabs.ListContainer><Tabs.List>
                <Tabs.Tab id="detail">详情</Tabs.Tab>
                <Tabs.Tab id="tiers">等级</Tabs.Tab>
              </Tabs.List></Tabs.ListContainer>

              <Tabs.Panel id="detail" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1">
                  <TextField
                    value={String(draftSystem.name ?? '')}
                    onChange={(v) => setDraftSystem((s) => ({ ...s, name: v }))}
                    className="space-y-2"
                  >
                    <Label>体系名称</Label>
                    <Input placeholder="如：斗气大陆修炼体系" />
                  </TextField>
                  <TextField
                    value={String(draftSystem.category ?? '')}
                    onChange={(v) => setDraftSystem((s) => ({ ...s, category: v }))}
                    className="space-y-2"
                  >
                    <Label>类型标签</Label>
                    <Input placeholder="修仙 / 斗气 / 武道…" />
                  </TextField>
                  <TextField
                    value={String(draftSystem.description ?? '')}
                    onChange={(v) => setDraftSystem((s) => ({ ...s, description: v }))}
                    className="space-y-2"
                  >
                    <Label>体系说明</Label>
                    <TextArea rows={4} />
                  </TextField>
                </div>
                <DetailSaveFooter
                  onSave={handleSave}
                  saving={updateMutation.isPending}
                  disabled={!String(draftSystem.name ?? '').trim()}
                />
              </Tabs.Panel>

              <Tabs.Panel id="tiers" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <p className="text-sm font-medium">等级阶梯（{(draftSystem.levels ?? []).length} 级）</p>
                  <Button type="button" size="sm" variant="outline" onPress={addLevel}>
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                    添加等级
                  </Button>
                </div>
                <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                  {(draftSystem.levels ?? []).map((lv, index) => {
                    const subLabel = (lv.subLevels ?? [])
                      .map((s) => (typeof s === 'string' ? s : String(s?.name ?? '')))
                      .filter(Boolean)
                      .join(' · ')
                    return (
                      <Disclosure
                        key={index}
                        defaultExpanded={index === 0}
                        className="rounded-md border border-border"
                      >
                        <Disclosure.Heading>
                          <Button
                            slot="trigger"
                            variant="ghost"
                            className="flex h-auto w-full items-center justify-between rounded-none px-3 py-2 text-sm font-medium hover:bg-default"
                          >
                            <span className="text-left">
                              {index + 1}. {String(lv.name ?? '未命名')}
                              <span className="ml-2 text-xs font-normal text-muted">
                                {subLabel || '无细分'}
                              </span>
                            </span>
                            <Disclosure.Indicator />
                          </Button>
                        </Disclosure.Heading>
                        <Disclosure.Content>
                          <Disclosure.Body className="space-y-3 border-t border-border p-3">
                            <DynamicTemplateFields
                              fields={levelFields}
                              value={levelToFormValues(lv, levelFields)}
                              onChange={(vals) => updateLevel(index, formValuesToLevel(vals, lv))}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-danger"
                              isDisabled={(draftSystem.levels ?? []).length <= 1}
                              onPress={() => removeLevel(index)}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />
                              删除此等级
                            </Button>
                          </Disclosure.Body>
                        </Disclosure.Content>
                      </Disclosure>
                    )
                  })}
                </div>
                <DetailSaveFooter
                  onSave={handleSave}
                  saving={updateMutation.isPending}
                  disabled={!String(draftSystem.name ?? '').trim()}
                />
              </Tabs.Panel>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted">
            <Layers className="h-10 w-10" strokeWidth={1.5} />
            <p className="text-sm">选择左侧等级体系查看详情</p>
          </div>
        )}
      </div>
    </div>
  )
}
