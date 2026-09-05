'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon, ChevronRightIcon, CheckIcon } from 'lucide-react'
import { useDshChatContext } from '@/app/components/assistant-ui/dsh-chat-context'
import { cn } from '@/app/lib/utils'
import type { ModelCatalogModelDto, ModelProviderGroupDto } from '@/lib/ipc/schemas/model-schema'
import type { ModelSelectionDto } from '@/lib/ipc/schemas/chat-schema'

type Pane = 'root' | 'model' | 'effort'

type ModelChoice = {
  provider: string
  providerLabel: string
  model: ModelCatalogModelDto
}

function findModelChoice(
  providers: ModelProviderGroupDto[],
  selection: ModelSelectionDto | null | undefined,
): ModelChoice | undefined {
  if (!selection) return undefined
  for (const group of providers) {
    const model = group.models.find((m) => m.id === selection.model)
    if (model && group.provider === selection.provider) {
      return {
        provider: group.provider,
        providerLabel: group.label ?? group.provider,
        model,
      }
    }
  }
  return undefined
}

function effortLabelFor(
  choice: ModelChoice | undefined,
  selection: ModelSelectionDto | null | undefined,
): string | undefined {
  const reasoning = choice?.model.reasoning
  if (!reasoning) return undefined
  const effective = selection?.reasoningEffort ?? reasoning.defaultEffort
  if (effective === undefined) return 'Default'
  return reasoning.efforts.find((e) => e.id === effective)?.name ?? effective
}

export function DshModelPicker() {
  const { dshSessionId } = useDshChatContext()
  const queryClient = useQueryClient()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<Pane>('root')

  const catalogQuery = useQuery({
    queryKey: ['dsh-model-catalog'],
    queryFn: () => window.ipcApi.dsh.modelCatalog(),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

  const selectionQuery = useQuery({
    queryKey: ['dsh-session-model', dshSessionId],
    queryFn: () => window.ipcApi.dsh.sessionGetModelSelection({ dshSessionId }),
  })

  const selectMutation = useMutation({
    mutationFn: (args: ModelSelectionDto) =>
      window.ipcApi.dsh.sessionSelectModel({ dshSessionId, ...args }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dsh-session-model', dshSessionId] })
    },
  })

  const providers = catalogQuery.data?.providers ?? []
  const selection = selectionQuery.data?.selection ?? null
  const catalogDefault = catalogQuery.data?.default ?? null
  const effectiveSelection = selection ?? catalogDefault

  const choices = useMemo((): ModelChoice[] => {
    return providers.flatMap((group) =>
      group.models.map((model) => ({
        provider: group.provider,
        providerLabel: group.label ?? group.provider,
        model,
      })),
    )
  }, [providers])

  const currentChoice = useMemo(
    () => findModelChoice(providers, effectiveSelection),
    [providers, effectiveSelection],
  )

  const reasoning = currentChoice?.model.reasoning
  const effortLabel = effortLabelFor(currentChoice, effectiveSelection)
  const modelLabel =
    currentChoice?.model.label ??
    currentChoice?.model.id ??
    effectiveSelection?.model ??
    '模型'
  const busy = selectMutation.isPending

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setPane('root')
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  function closeMenu() {
    setOpen(false)
    setPane('root')
  }

  function openMenu() {
    setPane('root')
    setOpen(true)
  }

  function toggleMenu() {
    if (open) closeMenu()
    else openMenu()
  }

  async function applySelection(next: ModelSelectionDto) {
    const sameModel =
      effectiveSelection?.provider === next.provider &&
      effectiveSelection?.model === next.model
    const sameEffort =
      (effectiveSelection?.reasoningEffort ?? undefined) === (next.reasoningEffort ?? undefined)
    if (sameModel && sameEffort) {
      closeMenu()
      return
    }
    await selectMutation.mutateAsync(next)
    closeMenu()
  }

  function selectModel(choice: ModelChoice) {
    const next: ModelSelectionDto = {
      provider: choice.provider,
      model: choice.model.id,
    }
    const defaultEffort = choice.model.reasoning?.defaultEffort
    if (defaultEffort) {
      next.reasoningEffort = defaultEffort
    }
    void applySelection(next)
  }

  function selectEffort(effort: string | undefined) {
    if (!effectiveSelection) return
    const next: ModelSelectionDto = {
      provider: effectiveSelection.provider,
      model: effectiveSelection.model,
      ...(effort ? { reasoningEffort: effort } : {}),
    }
    void applySelection(next)
  }

  const effortChoices = useMemo(() => {
    if (!reasoning) return []
    const items: Array<{ key: string; effort: string | undefined; label: string }> = []
    if (reasoning.defaultEffort === undefined) {
      items.push({ key: 'provider-default', effort: undefined, label: 'Default' })
    }
    for (const effort of reasoning.efforts) {
      items.push({ key: effort.id, effort: effort.id, label: effort.name })
    }
    return items
  }, [reasoning])

  return (
    <div ref={rootRef} className="relative min-w-0 shrink-0">
      <button
        type="button"
        disabled={busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'border-border/60 text-muted hover:text-foreground flex h-7 max-w-[min(360px,45cqw)] items-center gap-1 rounded-full border bg-transparent px-2 pl-2 text-[13px] leading-5 font-medium transition-[color,transform] active:scale-[0.96]',
          'hover:bg-default/60 disabled:opacity-50',
        )}
        onClick={toggleMenu}
      >
        <span className="text-foreground/90 min-w-0 truncate">{modelLabel}</span>
        {effortLabel ? (
          <>
            <span className="text-muted/50 shrink-0" aria-hidden>
              ·
            </span>
            <span className="text-muted shrink-0">{effortLabel}</span>
          </>
        ) : null}
        <ChevronDownIcon
          className={cn(
            'text-muted size-3.5 shrink-0 transition-transform duration-150',
            open && 'rotate-180',
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="border-border/60 absolute bottom-full left-0 z-50 mb-2 min-w-[240px] overflow-hidden rounded-xl border bg-overlay py-1 shadow-md"
        >
          {pane === 'root' ? (
            <>
              <MenuRow
                label="模型"
                value={modelLabel}
                onClick={() => setPane('model')}
              />
              {reasoning ? (
                <MenuRow
                  label="推理等级"
                  value={effortLabel ?? 'Default'}
                  onClick={() => setPane('effort')}
                />
              ) : null}
            </>
          ) : null}

          {pane === 'model' ? (
            <div className="max-h-64 overflow-y-auto">
              {choices.length === 0 ? (
                <p className="text-muted px-3 py-2 text-xs">无可用模型</p>
              ) : (
                choices.map((choice) => {
                  const selected =
                    effectiveSelection?.provider === choice.provider &&
                    effectiveSelection?.model === choice.model.id
                  return (
                    <button
                      key={`${choice.provider}::${choice.model.id}`}
                      type="button"
                      role="menuitem"
                      className={cn(
                        'hover:bg-default mx-1 flex min-h-[32px] w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs',
                        selected && 'bg-accent-soft text-accent-soft-foreground',
                      )}
                      onClick={() => selectModel(choice)}
                    >
                      <span className="text-muted/70 min-w-0 flex-1 truncate text-xs">
                        {choice.providerLabel}
                      </span>
                      <span className="min-w-0 flex-[2] truncate text-xs">{choice.model.label ?? choice.model.id}</span>
                      {selected ? <CheckIcon className="text-accent size-3.5 shrink-0" /> : null}
                    </button>
                  )
                })
              )}
            </div>
          ) : null}

          {pane === 'effort' ? (
            <div className="max-h-64 overflow-y-auto">
              {effortChoices.map((item) => {
                const effective =
                  effectiveSelection?.reasoningEffort ?? reasoning?.defaultEffort
                const selected =
                  (item.effort === undefined && effective === undefined) ||
                  item.effort === effective
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className={cn(
                      'hover:bg-default mx-1 flex min-h-[32px] w-[calc(100%-0.5rem)] items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs',
                      selected && 'bg-accent-soft text-accent-soft-foreground',
                    )}
                    onClick={() => selectEffort(item.effort)}
                  >
                    <span>{item.label}</span>
                      {selected ? <CheckIcon className="text-accent size-3.5 shrink-0" /> : null}
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function MenuRow({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="hover:bg-default mx-1 flex h-8 w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg px-2.5 text-left text-xs"
      onClick={onClick}
    >
      <span className="text-foreground shrink-0">{label}</span>
      <span className="text-muted min-w-0 flex-1 truncate text-right">{value}</span>
      <ChevronRightIcon className="text-muted size-3.5 shrink-0" />
    </button>
  )
}
