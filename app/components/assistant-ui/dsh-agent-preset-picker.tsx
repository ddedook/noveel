'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BotIcon, CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useDshChatContext } from '@/app/components/assistant-ui/dsh-chat-context'
import { cn } from '@/app/lib/utils'

type PresetEntry = {
  id: string
  trust: 'system' | 'user'
  isDefault: boolean
  name?: string
  description?: string
  broken?: string
}

const BUILTIN_LABELS: Record<string, string> = {
  standard: '标准模式',
  ptc: 'PTC 模式',
  minimal: '极简模式',
  cordis: '创造模式',
}

function presetLabel(preset: PresetEntry): string {
  if (preset.name) return preset.name
  return BUILTIN_LABELS[preset.id] ?? preset.id
}

function findPresetLabel(presets: PresetEntry[], presetId: string | null | undefined): string {
  if (!presetId) return '模式'
  const preset = presets.find((p) => p.id === presetId)
  if (preset) return presetLabel(preset)
  return BUILTIN_LABELS[presetId] ?? presetId
}

export function DshAgentPresetPicker() {
  const { dshSessionId } = useDshChatContext()
  const queryClient = useQueryClient()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  const rosterQuery = useQuery({
    queryKey: ['dsh-agent-presets'],
    queryFn: () => window.ipcApi.dsh.agentPresetsList(),
    staleTime: 120_000,
  })

  const stateQuery = useQuery({
    queryKey: ['dsh-session-agent-preset', dshSessionId],
    queryFn: () => window.ipcApi.dsh.sessionGetAgentPreset({ dshSessionId }),
  })

  const selectMutation = useMutation({
    mutationFn: (presetId: string) =>
      window.ipcApi.dsh.sessionSelectAgentPreset({ dshSessionId, presetId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['dsh-session-agent-preset', dshSessionId] })
    },
  })

  const presets = rosterQuery.data?.presets ?? []
  const currentId = stateQuery.data?.presetId ?? null
  const locked = stateQuery.data?.locked ?? false
  const label = findPresetLabel(presets, currentId)
  const busy = selectMutation.isPending
  const ready = stateQuery.isSuccess && rosterQuery.isSuccess

  const options = useMemo(() => {
    return presets.filter((p) => !p.broken)
  }, [presets])

  const interactive = ready && !locked && options.length > 0

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  if (options.length === 0 && rosterQuery.isLoading) return null

  const lockedTitle = '本会话运行的 Agent 预设，对话开始后不可切换'

  function handleSelect(presetId: string) {
    if (presetId === currentId) {
      setOpen(false)
      return
    }
    void selectMutation.mutateAsync(presetId).then(() => setOpen(false))
  }

  return (
    <div ref={rootRef} className="relative min-w-0 shrink-0">
      <button
        type="button"
        disabled={!interactive || busy}
        aria-haspopup={interactive ? 'menu' : undefined}
        aria-expanded={interactive ? open : undefined}
        title={locked ? lockedTitle : undefined}
        className={cn(
          'flex h-7 max-w-[140px] items-center gap-1 rounded-full px-2 text-[13px] leading-5 font-medium transition-[color,transform]',
          interactive
            ? 'border-border/60 text-muted hover:text-foreground hover:bg-default/60 active:scale-[0.96] border bg-transparent'
            : 'text-muted cursor-default bg-transparent',
          (!interactive || busy) && 'opacity-80',
        )}
        onClick={() => {
          if (interactive) setOpen((value) => !value)
        }}
      >
        <BotIcon className="size-3.5 shrink-0 opacity-70" />
        <span className="min-w-0 truncate">{label}</span>
        {interactive ? (
          <ChevronDownIcon
            className={cn(
              'text-muted size-3.5 shrink-0 transition-transform duration-150',
              open && 'rotate-180',
            )}
          />
        ) : null}
      </button>

      {open && interactive ? (
        <div
          role="menu"
          className="border-border/60 absolute bottom-full left-0 z-50 mb-2 min-w-[200px] overflow-hidden rounded-xl border bg-overlay py-1 shadow-md"
        >
          {options.map((preset) => {
            const selected = preset.id === currentId
            return (
              <button
                key={preset.id}
                type="button"
                role="menuitem"
                className={cn(
                  'hover:bg-default mx-1 flex min-h-[32px] w-[calc(100%-0.5rem)] items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs',
                  selected && 'bg-accent-soft text-accent-soft-foreground',
                )}
                onClick={() => handleSelect(preset.id)}
              >
                <span className="min-w-0 truncate text-xs">{presetLabel(preset)}</span>
                {selected ? <CheckIcon className="text-accent size-3.5 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
