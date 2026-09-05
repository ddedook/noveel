import type { WebContents } from 'electron'
import { randomUUID } from 'node:crypto'
import { getHostContext } from '@/lib/main/dsh/host-boot'
import { serializeFollowFrame } from '@/lib/main/dsh/chat-event-mapper'
import { ChatProjection, projectionFromRecords, type HistoryRecord } from '@/lib/main/dsh/chat-projection'
import type { ChatMessageDto, ModelSelectionDto } from '@/lib/ipc/schemas/chat-schema'
import { getNovelContext } from '@/lib/main/novel/novel-context'

type SessionController = {
  page: (
    request: {
      address: { kind: 'session'; sessionId: string }
      throughSeq: number
      beforeSeq?: number
      maxMessages?: number
    },
    signal?: AbortSignal,
  ) => Promise<{ records: unknown[]; hasMore: boolean }>
  follow: (
    request: { address: { kind: 'session'; sessionId: string }; maxMessages?: number },
    signal: AbortSignal,
  ) => AsyncIterable<unknown>
  prompt: (
    request: {
      requestId: string
      sessionId: string
      mode: 'queue' | 'steer'
      content: Array<{ type: 'text'; text: string }>
      clientTimeZone?: string
    },
    signal: AbortSignal,
  ) => Promise<{ accepted: true }>
  cancel: (request: { sessionId: string }) => Promise<{ accepted: true }>
}

type Subscription = {
  abort: AbortController
  webContents: WebContents
  projection: ChatProjection
}

const subscriptions = new Map<string, Subscription>()
const sessionModelSelections = new Map<string, ModelSelectionDto>()

function subscriptionKey(webContentsId: number, dshSessionId: string): string {
  return `${String(webContentsId)}:${dshSessionId}`
}

function getSessionController(): SessionController {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const controller = ctx.get('sessionController') as SessionController | undefined
  if (!controller?.follow || !controller.prompt) {
    throw new Error('DSH session controller unavailable')
  }
  return controller
}

export async function loadChatHistory(dshSessionId: string): Promise<{
  messages: ChatMessageDto[]
  cursor: number
  isRunning: boolean
  modelSelection?: ModelSelectionDto
  turnError?: string
}> {
  const controller = getSessionController()
  const abort = new AbortController()
  const address = { kind: 'session' as const, sessionId: dshSessionId }

  try {
    const stream = controller.follow({ address, maxMessages: 500 }, abort.signal)
    const iterator = stream[Symbol.asyncIterator]()
    const first = await iterator.next()
    abort.abort()

    if (first.done || typeof first.value !== 'object' || first.value === null) {
      return { messages: [], cursor: -1, isRunning: false }
    }

    const snapshot = first.value as { type?: string; cursor?: number; records?: unknown[] }
    if (snapshot.type !== 'snapshot') {
      return { messages: [], cursor: -1, isRunning: false }
    }

    const records = (snapshot.records ?? []) as HistoryRecord[]
    const snap = projectionFromRecords(records)
    if (snap.modelSelection) {
      sessionModelSelections.set(dshSessionId, snap.modelSelection)
    }
    return {
      messages: snap.messages,
      cursor: typeof snapshot.cursor === 'number' ? snapshot.cursor : -1,
      isRunning: snap.isRunning,
      modelSelection: snap.modelSelection,
      ...(snap.turnError ? { turnError: snap.turnError } : {}),
    }
  } catch {
    abort.abort()
    return { messages: [], cursor: -1, isRunning: false }
  }
}

const DEBUG_LOG_MAX_RECORDS = 200
const DEBUG_LOG_MAX_BYTES = 512 * 1024
const DEBUG_LOG_STRING_LIMIT = 8_192

const SENSITIVE_KEY_RE =
  /oauth|token|api[_-]?key|password|passwd|secret|authorization|cookie|credential|refresh/i

function truncateString(value: string, limit = DEBUG_LOG_STRING_LIMIT): { value: string; truncated: boolean } {
  if (value.length <= limit) return { value, truncated: false }
  return { value: `${value.slice(0, limit)}…`, truncated: true }
}

function sanitizeForDebugLog(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[max-depth]'
  if (typeof value === 'string') {
    const t = truncateString(value)
    return t.truncated ? { value: t.value, truncated: true } : t.value
  }
  if (typeof value !== 'object' || value === null) return value
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDebugLog(item, depth + 1))
  }
  const out: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      out[key] = '[redacted]'
      continue
    }
    out[key] = sanitizeForDebugLog(child, depth + 1)
  }
  return out
}

function extractToolCalls(messages: ChatMessageDto[]): Array<Record<string, unknown>> {
  const tools: Array<Record<string, unknown>> = []
  for (const message of messages) {
    for (const part of message.content) {
      if (part.type !== 'tool-call') continue
      const result =
        typeof part.result === 'string' ? truncateString(part.result) : undefined
      tools.push({
        messageId: message.id,
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        argsText: truncateString(part.argsText).value,
        ...(result
          ? {
              result: result.value,
              ...(result.truncated ? { truncated: true } : {}),
            }
          : {}),
        ...(part.isError ? { isError: true } : {}),
      })
    }
  }
  return tools
}

export async function exportChatDebugLog(dshSessionId: string): Promise<{ json: string }> {
  const controller = getSessionController()
  const abort = new AbortController()
  const address = { kind: 'session' as const, sessionId: dshSessionId }

  let records: HistoryRecord[] = []
  let cursor = -1
  let fetchError: string | undefined

  try {
    const stream = controller.follow({ address, maxMessages: DEBUG_LOG_MAX_RECORDS }, abort.signal)
    const iterator = stream[Symbol.asyncIterator]()
    const first = await iterator.next()
    abort.abort()

    if (!first.done && typeof first.value === 'object' && first.value !== null) {
      const snapshot = first.value as { type?: string; cursor?: number; records?: unknown[] }
      if (snapshot.type === 'snapshot') {
        records = (snapshot.records ?? []) as HistoryRecord[]
        cursor = typeof snapshot.cursor === 'number' ? snapshot.cursor : -1
      }
    }
  } catch (error) {
    abort.abort()
    fetchError = error instanceof Error ? error.message : String(error)
  }

  if (records.length > DEBUG_LOG_MAX_RECORDS) {
    records = records.slice(-DEBUG_LOG_MAX_RECORDS)
  }

  const snap = projectionFromRecords(records)
  const modelSelection =
    snap.modelSelection ?? sessionModelSelections.get(dshSessionId) ?? undefined
  const { novelId } = getNovelContext()

  const errors: string[] = []
  if (snap.turnError) errors.push(snap.turnError)
  if (fetchError) errors.push(`fetch: ${fetchError}`)

  let truncatedRecords = records
  let recordsTruncated = false
  let json = ''

  for (;;) {
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      dshSessionId,
      ...(novelId ? { novelId } : {}),
      cursor,
      isRunning: snap.isRunning,
      ...(modelSelection ? { modelSelection } : {}),
      errors,
      toolCalls: extractToolCalls(snap.messages),
      messages: sanitizeForDebugLog(snap.messages),
      records: sanitizeForDebugLog(truncatedRecords),
      recordCount: truncatedRecords.length,
      ...(recordsTruncated ? { recordsTruncated: true } : {}),
    }
    json = JSON.stringify(payload, null, 2)
    if (json.length <= DEBUG_LOG_MAX_BYTES || truncatedRecords.length <= 10) break
    truncatedRecords = truncatedRecords.slice(Math.ceil(truncatedRecords.length / 2))
    recordsTruncated = true
  }

  if (json.length > DEBUG_LOG_MAX_BYTES) {
    json = `${json.slice(0, DEBUG_LOG_MAX_BYTES)}\n…[truncated]`
  }

  return { json }
}

export async function sendChatPrompt(
  dshSessionId: string,
  text: string,
  requestId: string = randomUUID(),
  mode: 'queue' | 'steer' = 'queue',
): Promise<{ accepted: true; requestId: string }> {
  const controller = getSessionController()
  await controller.prompt(
    {
      requestId,
      sessionId: dshSessionId,
      mode,
      content: [{ type: 'text', text }],
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    new AbortController().signal,
  )
  return { accepted: true, requestId }
}

export async function cancelChat(dshSessionId: string): Promise<{ accepted: true }> {
  const controller = getSessionController()
  return controller.cancel({ sessionId: dshSessionId })
}

export function subscribeChatEvents(dshSessionId: string, webContents: WebContents): void {
  const key = subscriptionKey(webContents.id, dshSessionId)
  unsubscribeChatEvents(dshSessionId, webContents)

  const abort = new AbortController()
  const projection = new ChatProjection()
  subscriptions.set(key, { abort, webContents, projection })

  void (async () => {
    try {
      const controller = getSessionController()
      const address = { kind: 'session' as const, sessionId: dshSessionId }
      for await (const frame of controller.follow({ address, maxMessages: 500 }, abort.signal)) {
        if (webContents.isDestroyed()) break
        const payload = serializeFollowFrame(frame, projection)
        if (payload.modelSelection && typeof payload.modelSelection === 'object') {
          const sel = payload.modelSelection as ModelSelectionDto
          if (sel.provider && sel.model) {
            sessionModelSelections.set(dshSessionId, sel)
          }
        }
        webContents.send('dsh:chatEvent', { dshSessionId, ...payload })
      }
      if (!webContents.isDestroyed()) {
        webContents.send('dsh:chatEvent', { dshSessionId, kind: 'done' })
      }
    } catch (error) {
      if (!abort.signal.aborted && !webContents.isDestroyed()) {
        webContents.send('dsh:chatEvent', {
          dshSessionId,
          kind: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    } finally {
      subscriptions.delete(key)
    }
  })()
}

export function unsubscribeChatEvents(dshSessionId: string, webContents: WebContents): void {
  const key = subscriptionKey(webContents.id, dshSessionId)
  const existing = subscriptions.get(key)
  if (!existing) return
  existing.abort.abort()
  subscriptions.delete(key)
}

export function unsubscribeAllForWebContents(webContents: WebContents): void {
  for (const [key, sub] of subscriptions.entries()) {
    if (sub.webContents.id !== webContents.id) continue
    sub.abort.abort()
    subscriptions.delete(key)
  }
}

export function unsubscribeAllChatEvents(): void {
  for (const sub of subscriptions.values()) {
    sub.abort.abort()
  }
  subscriptions.clear()
}

export function cacheSessionModelSelection(
  dshSessionId: string,
  selection: ModelSelectionDto,
): void {
  if (selection.provider && selection.model) {
    sessionModelSelections.set(dshSessionId, selection)
  }
}

export async function getSessionModelSelection(
  dshSessionId: string,
): Promise<ModelSelectionDto | null> {
  const cached = sessionModelSelections.get(dshSessionId)
  if (cached) return cached
  const history = await loadChatHistory(dshSessionId)
  if (history.modelSelection) {
    sessionModelSelections.set(dshSessionId, history.modelSelection)
    return history.modelSelection
  }
  return null
}
