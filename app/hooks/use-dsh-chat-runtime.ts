import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useExternalStoreRuntime, type AppendMessage, type ThreadMessageLike } from '@assistant-ui/react'
import type { ChatMessageDto } from '@/lib/ipc/schemas/chat-schema'
import { useDshBusyEnter } from '@/app/hooks/use-dsh-busy-enter'

export type ChatStoreMessage = ThreadMessageLike & { id: string }

function dtoToStoreMessage(dto: ChatMessageDto): ChatStoreMessage {
  const content = dto.content.map((part) => {
    if (part.type === 'text') return { type: 'text' as const, text: part.text }
    if (part.type === 'reasoning') return { type: 'reasoning' as const, text: part.text }
    if (part.type === 'context-injection') {
      return {
        type: 'data' as const,
        name: 'context-injection',
        data: {
          role: part.role,
          label: part.label,
          ...(part.summary ? { summary: part.summary } : {}),
        },
      }
    }
    return {
      type: 'tool-call' as const,
      toolCallId: part.toolCallId,
      toolName: part.toolName,
      args: {},
      argsText: part.argsText,
      result: part.result,
      isError: part.isError,
    }
  })

  if (dto.role === 'assistant') {
    return {
      id: dto.id,
      role: 'assistant',
      content,
      status:
        dto.status === 'running'
          ? { type: 'running' as const }
          : { type: 'complete' as const, reason: 'stop' as const },
    }
  }

  return {
    id: dto.id,
    role: 'user',
    content,
  }
}

function createRequestId(): string {
  return crypto.randomUUID()
}

export function useDshChatRuntime(dshSessionId: string | null) {
  const busyEnter = useDshBusyEnter()
  const [messages, setMessages] = useState<ChatStoreMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const dshSessionIdRef = useRef<string | null>(dshSessionId)
  const isRunningRef = useRef(false)

  useEffect(() => {
    dshSessionIdRef.current = dshSessionId
  }, [dshSessionId])

  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])

  useEffect(() => {
    if (!dshSessionId) {
      setMessages([])
      setIsRunning(false)
      setLoading(false)
      setSending(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        await window.ipcApi.dsh.chatUnsubscribe({ dshSessionId })
        const history = await window.ipcApi.dsh.chatLoadHistory({ dshSessionId })
        if (cancelled) return
        setMessages(history.messages.map(dtoToStoreMessage))
        setIsRunning(history.isRunning)
        if (history.turnError) setError(history.turnError)
        await window.ipcApi.dsh.chatSubscribe({ dshSessionId })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载对话失败')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    const off = window.ipcApi.dsh.onChatEvent((payload) => {
      if (payload.dshSessionId !== dshSessionIdRef.current) return

      if (payload.kind === 'snapshot' && payload.messages) {
        setMessages(payload.messages.map(dtoToStoreMessage))
        setIsRunning(Boolean(payload.isRunning))
        setSending(false)
        if (payload.turnError) {
          setError(payload.turnError)
        } else if (payload.isRunning) {
          setError(null)
        }
        return
      }

      if (payload.kind === 'error') {
        setError(payload.error ?? '对话流错误')
        setIsRunning(false)
        setSending(false)
        return
      }

      if (payload.kind === 'done') {
        setIsRunning(false)
        setSending(false)
      }
    })

    return () => {
      cancelled = true
      off()
      void window.ipcApi.dsh.chatUnsubscribe({ dshSessionId })
    }
  }, [dshSessionId])

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const sessionId = dshSessionIdRef.current
      if (!sessionId) return

      const text = message.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim()
      if (!text) return

      const requestId = createRequestId()
      const steer = Boolean(message.steer)
      const mode: 'queue' | 'steer' =
        steer || (isRunningRef.current && busyEnter === 'steer') ? 'steer' : 'queue'

      setSending(true)
      setError(null)

      try {
        await window.ipcApi.dsh.chatPrompt({
          dshSessionId: sessionId,
          requestId,
          text,
          mode,
        })
      } catch (err) {
        setSending(false)
        setError(err instanceof Error ? err.message : '发送失败')
      }
    },
    [busyEnter],
  )

  const onCancel = useCallback(async () => {
    const sessionId = dshSessionIdRef.current
    if (!sessionId) return
    await window.ipcApi.dsh.chatCancel({ dshSessionId: sessionId })
    setIsRunning(false)
    setSending(false)
  }, [])

  const runtime = useExternalStoreRuntime({
    isRunning: isRunning || sending,
    messages,
    setMessages: (next) => setMessages([...next]),
    convertMessage: (m) => m,
    onNew,
    onCancel,
  })

  return useMemo(
    () => ({ runtime, loading, error, isRunning, sending, busyEnter }),
    [runtime, loading, error, isRunning, sending, busyEnter],
  )
}
