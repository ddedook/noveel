import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '@/app/lib/toast'
import { ZodError } from 'zod'
import { Button, Tabs } from '@heroui/react'
import type { FormTemplateConfig, FormTemplateSectionKey } from '@/lib/ipc/schemas/form-template-schema'
import { emptyFormTemplateConfig, formTemplateConfigSchema } from '@/lib/ipc/schemas/form-template-schema'
import {
  DynamicTemplateFields,
  applyFieldDefaults,
} from '@/app/components/novel-workspace/dynamic-template-fields'
import { TemplateJsonEditor } from '@/app/components/novel-workspace/template-json-editor'
import { SegmentedControl } from '@/app/components/segmented-control'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { NOVEL_FORM_MAX_WIDTH } from '@/app/lib/novel-form-layout'
import { emptyWorldNodeDetail } from '@/app/lib/world-kinds'

const SECTION_TAB_ITEMS: { key: FormTemplateSectionKey; label: string }[] = [
  { key: 'overview', label: '概述' },
  { key: 'world', label: '世界' },
  { key: 'role', label: '人物' },
  { key: 'creature', label: '生物' },
  { key: 'level', label: '等级' },
  { key: 'timeline', label: '时间线' },
  { key: 'outline', label: '大纲' },
  { key: 'item', label: '物品' },
]

function sectionSlice(cfg: FormTemplateConfig, key: FormTemplateSectionKey): unknown {
  switch (key) {
    case 'overview':
      return cfg.overview
    case 'role':
      return cfg.role
    case 'level':
      return cfg.level
    case 'world':
      return cfg.world
    case 'timeline':
      return cfg.timeline
    case 'outline':
      return cfg.outline
    case 'item':
      return cfg.item
    case 'creature':
      return cfg.creature
    default:
      return {}
  }
}

function mergeSection(
  base: FormTemplateConfig,
  sectionKey: FormTemplateSectionKey,
  fragment: unknown,
): FormTemplateConfig {
  const next = structuredClone(base)
  switch (sectionKey) {
    case 'overview':
      next.overview = formTemplateConfigSchema.shape.overview.parse(fragment)
      break
    case 'role':
      next.role = formTemplateConfigSchema.shape.role.parse(fragment)
      break
    case 'level':
      next.level = formTemplateConfigSchema.shape.level.parse(fragment)
      break
    case 'world':
      next.world = formTemplateConfigSchema.shape.world.parse(fragment)
      break
    case 'timeline':
      next.timeline = formTemplateConfigSchema.shape.timeline.parse(fragment)
      break
    case 'outline':
      next.outline = formTemplateConfigSchema.shape.outline.parse(fragment)
      break
    case 'item':
      next.item = formTemplateConfigSchema.shape.item.parse(fragment)
      break
    case 'creature':
      next.creature = formTemplateConfigSchema.shape.creature.parse(fragment)
      break
    default:
      break
  }
  return formTemplateConfigSchema.parse(next)
}

function emptyLevelPreview(): Record<string, unknown> {
  return {
    name: '第一阶',
    subLevels: ['初期', '中期', '后期'],
    promotionCondition: '',
    abilities: '',
  }
}

export function NovelTemplatePage() {
  const { novelId } = useNovelRouteContext('template')
  const queryClient = useQueryClient()

  const [sectionKey, setSectionKey] = useState<FormTemplateSectionKey>('overview')
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
  const jsonLiveRef = useRef('')
  const [outlinePreviewKind, setOutlinePreviewKind] = useState<'volume' | 'chapter_segment'>('volume')
  const [itemPreviewKind, setItemPreviewKind] = useState<'detail' | 'timeline'>('detail')
  const [creaturePreviewKind, setCreaturePreviewKind] = useState<'detail' | 'timeline'>('detail')
  const [rolePreviewKind, setRolePreviewKind] = useState<'detail' | 'relation' | 'timeline'>('detail')
  const [worldPreviewKind, setWorldPreviewKind] = useState<'detail' | 'timeline'>('detail')
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({})

  const templateQuery = useQuery({
    queryKey: ['formTemplate', novelId],
    queryFn: () => window.ipcApi.formTemplate.get({ novelId: novelId! }),
    enabled: Boolean(novelId),
  })

  const cfg = templateQuery.data ?? emptyFormTemplateConfig()
  const jsonEditorSeed = `${sectionKey}-${templateQuery.dataUpdatedAt}`

  const jsonInitialValue = useMemo(() => {
    try {
      return JSON.stringify(sectionSlice(cfg, sectionKey) ?? {}, null, 2)
    } catch {
      return '{}'
    }
  }, [cfg, sectionKey, templateQuery.dataUpdatedAt])

  useEffect(() => {
    jsonLiveRef.current = jsonInitialValue
  }, [jsonInitialValue])

  const previewFields = useMemo(() => {
    switch (sectionKey) {
      case 'overview':
        return cfg.overview.fields
      case 'role':
        if (rolePreviewKind === 'detail') return cfg.role.detailFields
        if (rolePreviewKind === 'relation') return cfg.role.relation?.extraFields ?? []
        return cfg.role.timeline?.extraFields ?? []
      case 'level':
        return cfg.level.levelFields
      case 'world':
        return worldPreviewKind === 'detail'
          ? cfg.world.defaultDetailFields
          : (cfg.world.timeline?.extraFields ?? [])
      case 'timeline':
        return cfg.timeline.extraFields ?? []
      case 'outline':
        return outlinePreviewKind === 'volume' ? cfg.outline.volumeFields : cfg.outline.chapterSegmentFields
      case 'item':
        return itemPreviewKind === 'detail' ? cfg.item.detailFields : (cfg.item.timeline?.extraFields ?? [])
      case 'creature':
        return creaturePreviewKind === 'detail'
          ? cfg.creature.detailFields
          : (cfg.creature.timeline?.extraFields ?? [])
      default:
        return []
    }
  }, [cfg, sectionKey, outlinePreviewKind, itemPreviewKind, creaturePreviewKind, rolePreviewKind, worldPreviewKind])

  const previewInitValues = useMemo(() => {
    switch (sectionKey) {
      case 'overview':
        return applyFieldDefaults({}, previewFields)
      case 'role':
        return applyFieldDefaults(
          rolePreviewKind === 'detail'
            ? { name: '' }
            : rolePreviewKind === 'relation'
              ? { fromRoleId: '', toRoleId: '', label: '' }
              : { content: '' },
          previewFields,
        )
      case 'level':
        return applyFieldDefaults(emptyLevelPreview(), previewFields)
      case 'world':
        return applyFieldDefaults(
          worldPreviewKind === 'detail' ? { ...emptyWorldNodeDetail() } : { content: '' },
          previewFields,
        )
      case 'timeline':
        return applyFieldDefaults({ content: '' }, previewFields)
      case 'outline':
        return applyFieldDefaults(
          outlinePreviewKind === 'volume' ? { content: '' } : { chapterRange: '', name: '', content: '' },
          previewFields,
        )
      case 'item':
        return applyFieldDefaults(itemPreviewKind === 'detail' ? { name: '' } : { content: '' }, previewFields)
      case 'creature':
        return applyFieldDefaults(creaturePreviewKind === 'detail' ? { name: '' } : { content: '' }, previewFields)
      default:
        return {}
    }
  }, [
    sectionKey,
    outlinePreviewKind,
    itemPreviewKind,
    creaturePreviewKind,
    rolePreviewKind,
    worldPreviewKind,
    previewFields,
  ])

  useEffect(() => {
    setPreviewValues(previewInitValues)
  }, [previewInitValues])

  const saveMutation = useMutation({
    mutationFn: async () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(jsonLiveRef.current || jsonInitialValue)
      } catch {
        throw new Error('JSON 格式不正确')
      }
      let merged: FormTemplateConfig
      try {
        merged = mergeSection(cfg, sectionKey, parsed)
      } catch (e) {
        if (e instanceof ZodError) {
          throw new Error(e.issues[0]?.message ?? 'JSON 校验失败')
        }
        throw e
      }
      return window.ipcApi.formTemplate.update({ novelId: novelId!, config: merged })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['formTemplate', novelId] })
      toast.success('已保存')
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  if (!novelId) return <div />

  if (templateQuery.isLoading) {
    return <div className="px-4 py-8 text-sm text-muted">加载中…</div>
  }

  if (templateQuery.isError) {
    return (
      <div className="flex flex-col gap-2 px-4 py-8">
        <p className="text-sm text-danger">加载失败</p>
        <Button variant="outline" onPress={() => void queryClient.invalidateQueries({ queryKey: ['formTemplate', novelId] })}>
          重试
        </Button>
      </div>
    )
  }

  return (
    <div className="app-no-drag flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-2">
        <Tabs
          selectedKey={sectionKey}
          onSelectionChange={(key) => setSectionKey(key as FormTemplateSectionKey)}
        >
          <Tabs.ListContainer>
            <Tabs.List className="h-9 w-full justify-start">
              {SECTION_TAB_ITEMS.map((item) => (
                <Tabs.Tab
                  key={item.key}
                  id={item.key}
                  className="h-8 shrink-0 px-3 data-[selected]:shadow-sm"
                >
                  {item.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={mode}
            onChange={setMode}
            options={[
              { value: 'preview', label: '预览' },
              { value: 'edit', label: '编辑' },
            ]}
          />

          {sectionKey === 'outline' && mode === 'preview' ? (
            <SegmentedControl
              value={outlinePreviewKind}
              onChange={setOutlinePreviewKind}
              options={[
                { value: 'volume', label: '卷' },
                { value: 'chapter_segment', label: '章节说明' },
              ]}
            />
          ) : null}

          {sectionKey === 'role' && mode === 'preview' ? (
            <SegmentedControl
              value={rolePreviewKind}
              onChange={setRolePreviewKind}
              options={[
                { value: 'detail', label: '详情字段' },
                { value: 'relation', label: '关系字段' },
                { value: 'timeline', label: '时间字段' },
              ]}
            />
          ) : null}

          {sectionKey === 'item' && mode === 'preview' ? (
            <SegmentedControl
              value={itemPreviewKind}
              onChange={setItemPreviewKind}
              options={[
                { value: 'detail', label: '详情字段' },
                { value: 'timeline', label: '时间字段' },
              ]}
            />
          ) : null}

          {sectionKey === 'creature' && mode === 'preview' ? (
            <SegmentedControl
              value={creaturePreviewKind}
              onChange={setCreaturePreviewKind}
              options={[
                { value: 'detail', label: '详情字段' },
                { value: 'timeline', label: '时间字段' },
              ]}
            />
          ) : null}

          {sectionKey === 'world' && mode === 'preview' ? (
            <SegmentedControl
              value={worldPreviewKind}
              onChange={setWorldPreviewKind}
              options={[
                { value: 'detail', label: '详情字段' },
                { value: 'timeline', label: '世界线字段' },
              ]}
            />
          ) : null}
        </div>

        {sectionKey === 'level' ? (
          <p className="mt-2 text-sm text-muted">
            等级表单字段（每一级共用）：配置的是等级页「等级」Tab 里单个大等级的表单项，不是体系名称/分类/说明。
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden pb-4 pt-3">
        {mode === 'edit' ? (
          <div className="flex h-full min-h-0 flex-col gap-2 px-4">
            <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border p-px">
              <TemplateJsonEditor
                key={jsonEditorSeed}
                value={jsonInitialValue}
                onChange={(v) => {
                  jsonLiveRef.current = v
                }}
                className="h-full min-h-0 [&_.cm-editor]:rounded-[calc(var(--radius)-1px)] [&_.cm-editor]:border-0"
              />
            </div>
            <div className="shrink-0">
              <Button isDisabled={saveMutation.isPending} onPress={() => void saveMutation.mutate()}>
                {saveMutation.isPending ? '保存中…' : '校验并保存'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-0 overflow-auto px-4">
            <div className={NOVEL_FORM_MAX_WIDTH}>
              <DynamicTemplateFields
                key={`${sectionKey}-${outlinePreviewKind}-${itemPreviewKind}-${rolePreviewKind}-${worldPreviewKind}-${previewFields.length}`}
                fields={previewFields}
                value={previewValues}
                onChange={setPreviewValues}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
