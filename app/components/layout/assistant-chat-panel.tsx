import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { Thread } from '@/app/components/assistant-ui/elements/thread.aui'
import { TooltipIconButton } from '@/app/components/assistant-ui/elements/tooltip-icon-button'
import { DshChatProvider } from '@/app/components/assistant-ui/dsh-chat-context'
import {
  NOVEEL_CHAT_AUI_CONFIG,
  NOVEEL_THREAD_COMPONENTS,
  ContextInjectionDataUI,
} from '@/app/components/assistant-ui/noveel-chat-config'
import { useDshChatRuntime } from '@/app/hooks/use-dsh-chat-runtime'
import { useAppStore } from '@/app/lib/app-store'
import { copyChatDebugLog } from '@/app/lib/copy-chat-debug-log'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScrollTextIcon } from 'lucide-react'
import { useState } from 'react'

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)

type AssistantChatPanelProps = {
  collapsed: boolean
}

export function AssistantChatPanel({ collapsed }: AssistantChatPanelProps) {
  const queryClient = useQueryClient()
  const currentSessionId = useAppStore((s) => s.currentSessionId)
  const currentNovelId = useAppStore((s) => s.currentNovelId)

  const sessionsQuery = useQuery({
    queryKey: ['sessions', currentNovelId],
    queryFn: () => window.ipcApi.novelSession.list({ novelId: currentNovelId! }),
    enabled: Boolean(currentNovelId),
  })

  const currentSession = (sessionsQuery.data ?? []).find((s) => s.id === currentSessionId)
  const dshSessionId = currentSession?.dshSessionId ?? null
  const { runtime, loading, error, busyEnter } = useDshChatRuntime(collapsed ? null : dshSessionId)
  const [copyingLog, setCopyingLog] = useState(false)

  const bindMutation = useMutation({
    mutationFn: () => window.ipcApi.dsh.sessionCreateAndBind({ novelSessionId: currentSessionId! }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', currentNovelId] })
    },
  })

  const welcomeHint = `就「${currentSession?.title ?? '当前会话'}」向 AI 提问`

  const copyLog = () => {
    if (!dshSessionId || copyingLog) return
    setCopyingLog(true)
    void copyChatDebugLog(dshSessionId).finally(() => setCopyingLog(false))
  }

  const copyLogButton = (
    <TooltipIconButton
      tooltip="复制会话日志"
      side="bottom"
      type="button"
      isIconOnly
      size="sm"
      className="size-7 shrink-0"
      aria-label="复制会话日志"
      isDisabled={!dshSessionId || copyingLog}
      onPress={copyLog}
    >
      <ScrollTextIcon className="size-4" />
    </TooltipIconButton>
  )

  return (
    <div className="assistant-chat-panel relative flex h-full min-h-0 flex-col bg-background">
      {isMac ? (
        <div className="noveel-mac-titlebar flex shrink-0 items-center border-b border-border pr-2">
          <div className="app-drag-region min-w-0 flex-1 self-stretch" />
          <div className="app-no-drag flex shrink-0 items-center">{copyLogButton}</div>
        </div>
      ) : (
        <div className="app-no-drag absolute top-1.5 right-2 z-10">{copyLogButton}</div>
      )}

      {error ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-danger/30 bg-danger/10 px-3 py-1.5 text-xs text-danger">
          <span className="min-w-0 flex-1 truncate">{error}</span>
          <button
            type="button"
            className="shrink-0 rounded border border-danger/40 px-2 py-0.5 text-xs hover:bg-danger/15 disabled:opacity-50"
            disabled={!dshSessionId || copyingLog}
            onClick={copyLog}
          >
            复制会话日志
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {!currentNovelId ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted">
            请先选择小说
          </div>
        ) : !currentSessionId ? (
          <div className="flex h-full items-center justify-center px-4 text-sm text-muted">
            选择或创建一个会话
          </div>
        ) : !dshSessionId ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-sm text-muted">
            <p>会话尚未绑定 DSH</p>
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-default active:scale-[0.96] transition-transform"
              disabled={bindMutation.isPending}
              onClick={() => bindMutation.mutate()}
            >
              {bindMutation.isPending ? '绑定中…' : '绑定 DSH 会话'}
            </button>
          </div>
        ) : loading ? (
          <div className="flex h-full flex-col justify-center gap-2 px-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-default" />
            ))}
          </div>
        ) : (
          <AssistantRuntimeProvider runtime={runtime} config={NOVEEL_CHAT_AUI_CONFIG}>
            <ContextInjectionDataUI />
            <DshChatProvider
              dshSessionId={dshSessionId}
              busyEnter={busyEnter}
              welcomeHint={welcomeHint}
            >
              <Thread components={NOVEEL_THREAD_COMPONENTS} />
            </DshChatProvider>
          </AssistantRuntimeProvider>
        )}
      </div>
    </div>
  )
}
