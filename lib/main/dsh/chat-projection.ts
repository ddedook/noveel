import type { ChatMessageDto, ChatMessagePart } from '@/lib/ipc/schemas/chat-schema'

export type WireEvent = {
  type: string
  seq: number
  time?: number
  data?: Record<string, unknown>
}

export type HistoryRecord =
  | { type: 'event'; event: WireEvent }
  | { type: 'chunks'; event: WireEvent }

export type ModelSelection = {
  provider: string
  model: string
}

export type ChatSnapshot = {
  messages: ChatMessageDto[]
  isRunning: boolean
  modelSelection?: ModelSelection
  turnError?: string
}

type ContextInjectionBlock = {
  kind: 'context-injection'
  role: 'inject' | 'recall' | 'system-prompt'
  label: string
  summary?: string
}

type Block =
  | { kind: 'text'; text: string }
  | { kind: 'reasoning'; text: string }
  | {
      kind: 'tool-call'
      toolCallId: string
      toolName: string
      argsText: string
      result?: string
      isError?: boolean
    }
  | ContextInjectionBlock

type AssistantStepState = {
  turn: number
  step: number
  messageId: string
  /** Injected context rows, in event order. */
  contextBlocks: ContextInjectionBlock[]
  /** Streamed assistant blocks keyed by wire chunk index. */
  streamBlocks: (Block | undefined)[]
}

function readNumber(data: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = data?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function collectLabels(source: Record<string, unknown>, member: string, field: string): string[] {
  const list = source[member]
  if (!Array.isArray(list)) return []
  const seen: string[] = []
  for (const entry of list) {
    const record = asRecord(entry)
    const value = record === null ? null : readString(record, field)
    if (value !== null && !seen.includes(value)) seen.push(value)
  }
  return seen
}

function joined(names: string[]): string | null {
  return names.length > 0 ? names.join(', ') : null
}

function isUserMessageSource(source: unknown): boolean {
  const record = asRecord(source)
  if (record === null) return true
  const kind = readString(record, 'kind')
  return kind === null || kind === 'user'
}

export function projectContextProvenance(source: unknown): {
  role: 'inject' | 'recall' | 'system-prompt'
  label: string | null
} {
  const record = asRecord(source)
  const kind = record === null ? null : readString(record, 'kind')
  if (record === null || kind === null) {
    return { role: 'inject', label: null }
  }
  switch (kind) {
    case 'session-reference':
      return {
        role: 'recall',
        label: joined(collectLabels(record, 'references', 'label')) ?? kind,
      }
    case 'agent-instructions':
      return {
        role: 'inject',
        label: joined(collectLabels(record, 'changes', 'path')) ?? kind,
      }
    case 'plugin':
      return { role: 'inject', label: readString(record, 'plugin') ?? kind }
    case 'skill-invocation':
      return { role: 'inject', label: readString(record, 'name') ?? kind }
    default:
      return { role: 'inject', label: kind }
  }
}

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part !== 'object' || part === null) return ''
      const typed = part as { type?: string; text?: string }
      if (typed.type === 'text' && typeof typed.text === 'string') return typed.text
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function emptyBlock(blockType: string | undefined): Block {
  if (blockType === 'reasoning') return { kind: 'reasoning', text: '' }
  if (blockType === 'tool-call') {
    return { kind: 'tool-call', toolCallId: '', toolName: '', argsText: '' }
  }
  return { kind: 'text', text: '' }
}

function blockToPart(block: Block): ChatMessagePart | null {
  if (block.kind === 'context-injection') {
    return {
      type: 'context-injection',
      role: block.role,
      label: block.label,
      ...(block.summary ? { summary: block.summary } : {}),
    }
  }
  if (block.kind === 'text' && block.text) {
    return { type: 'text', text: block.text }
  }
  if (block.kind === 'reasoning' && block.text) {
    return { type: 'reasoning', text: block.text }
  }
  if (block.kind === 'tool-call') {
    return {
      type: 'tool-call',
      toolCallId: block.toolCallId || 'pending',
      toolName: block.toolName || 'tool',
      argsText: block.argsText,
      result: block.result,
      isError: block.isError,
    }
  }
  return null
}

function blocksToParts(step: AssistantStepState): ChatMessagePart[] {
  const parts: ChatMessagePart[] = []
  for (const block of step.contextBlocks) {
    const part = blockToPart(block)
    if (part) parts.push(part)
  }
  for (const block of step.streamBlocks) {
    if (!block || block.kind === 'context-injection') continue
    const part = blockToPart(block)
    if (part) parts.push(part)
  }
  return parts
}

function partsFromAssistantMessage(message: unknown): ChatMessagePart[] {
  if (typeof message !== 'object' || message === null) return []
  const content = (message as { content?: unknown }).content
  if (!Array.isArray(content)) return []

  const parts: ChatMessagePart[] = []
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue
    const typed = block as {
      type?: string
      text?: string
      id?: string
      name?: string
      argsRaw?: string
    }
    if (typed.type === 'text' && typeof typed.text === 'string') {
      parts.push({ type: 'text', text: typed.text })
    } else if (typed.type === 'reasoning' && typeof typed.text === 'string') {
      parts.push({ type: 'reasoning', text: typed.text })
    } else if (typed.type === 'tool-call' && typeof typed.id === 'string') {
      parts.push({
        type: 'tool-call',
        toolCallId: typed.id,
        toolName: typeof typed.name === 'string' ? typed.name : 'tool',
        argsText: typeof typed.argsRaw === 'string' ? typed.argsRaw : '{}',
      })
    }
  }
  return parts
}

function appendContextInjection(
  stepState: AssistantStepState,
  injection: ContextInjectionBlock,
): void {
  if (stepState.contextBlocks.some((block) => block.label === injection.label)) return
  stepState.contextBlocks.push(injection)
}

export class ChatProjection {
  private messages: ChatMessageDto[] = []
  private currentStep: AssistantStepState | null = null
  private isRunning = false
  private modelSelection: ModelSelection | undefined
  private turnError: string | undefined
  private turnCounter = 0
  private stepCounter = 0
  private toolCallRefs = new Map<string, { step: AssistantStepState; blockIndex: number }>()

  reset(): void {
    this.messages = []
    this.currentStep = null
    this.isRunning = false
    this.modelSelection = undefined
    this.turnError = undefined
    this.turnCounter = 0
    this.stepCounter = 0
    this.toolCallRefs.clear()
  }

  applyRecord(record: HistoryRecord): void {
    if (record.type === 'event') {
      this.applyEvent(record.event)
    }
  }

  applyRecords(records: HistoryRecord[]): void {
    const events: WireEvent[] = []
    for (const record of records) {
      if (record.type === 'event') events.push(record.event)
    }
    events.sort((a, b) => a.seq - b.seq)
    for (const event of events) {
      this.applyEvent(event)
    }
  }

  applyEvent(event: WireEvent): void {
    const data = event.data ?? {}

    if (event.type === 'user/message') {
      const message = data as { id?: string; content?: unknown; source?: unknown }
      const source = message.source

      if (!isUserMessageSource(source)) {
        this.isRunning = true
        const turn = readNumber(data, 'turn') ?? this.turnCounter
        const step = readNumber(data, 'step') ?? 1
        const stepState = this.ensureStep(turn, step)
        const provenance = projectContextProvenance(source)
        const summaryText = textFromContent(message.content)
        appendContextInjection(stepState, {
          kind: 'context-injection',
          role: provenance.role,
          label: provenance.label ?? 'context',
          ...(summaryText ? { summary: summaryText.slice(0, 200) } : {}),
        })
        return
      }

      this.finalizeCurrentStep(false)
      const text = textFromContent(message.content)
      this.turnCounter = readNumber(data, 'turn') ?? this.turnCounter + 1
      this.messages.push({
        id: typeof message.id === 'string' ? message.id : `user-${String(event.seq)}`,
        role: 'user',
        content: text ? [{ type: 'text', text }] : [],
        status: 'complete',
      })
      this.isRunning = true
      this.turnError = undefined
      return
    }

    if (event.type === 'request/header') {
      const header = asRecord(data.header)
      const system = header === null ? '' : (readString(header, 'system') ?? '')
      if (system.length > 0) {
        this.isRunning = true
        const turn = readNumber(data, 'turn') ?? this.turnCounter
        const step = readNumber(data, 'step') ?? 1
        const stepState = this.ensureStep(turn, step)
        appendContextInjection(stepState, {
          kind: 'context-injection',
          role: 'system-prompt',
          label: '@deepseek-ai/dsh-system-prompt',
        })
      }
      return
    }

    if (event.type === 'assistant/chunk') {
      this.isRunning = true
      const chunk = data.chunk as Record<string, unknown> | undefined
      if (!chunk || typeof chunk !== 'object') return

      const turn = readNumber(data, 'turn') ?? this.turnCounter
      const step = readNumber(data, 'step') ?? this.stepCounter
      const stepState = this.ensureStep(turn, step)
      const index = typeof chunk.index === 'number' ? chunk.index : 0
      const blocks = [...stepState.streamBlocks]

      switch (chunk.type) {
        case 'block-start':
          blocks[index] = emptyBlock(typeof chunk.blockType === 'string' ? chunk.blockType : undefined)
          break
        case 'text-delta': {
          const prev = blocks[index]
          const text = typeof chunk.text === 'string' ? chunk.text : ''
          blocks[index] = {
            kind: 'text',
            text: (prev?.kind === 'text' ? prev.text : '') + text,
          }
          break
        }
        case 'reasoning-delta': {
          const prev = blocks[index]
          const text = typeof chunk.text === 'string' ? chunk.text : ''
          blocks[index] = {
            kind: 'reasoning',
            text: (prev?.kind === 'reasoning' ? prev.text : '') + text,
          }
          break
        }
        case 'tool-call-delta': {
          const prev = blocks[index]
          const base =
            prev?.kind === 'tool-call'
              ? prev
              : { kind: 'tool-call' as const, toolCallId: '', toolName: '', argsText: '' }
          const callId = base.toolCallId || String(chunk.id ?? '')
          const argsDelta = typeof chunk.argumentsDelta === 'string' ? chunk.argumentsDelta : ''
          blocks[index] = {
            kind: 'tool-call',
            toolCallId: callId,
            toolName: typeof chunk.name === 'string' ? chunk.name : base.toolName,
            argsText: base.argsText + argsDelta,
          }
          if (callId) {
            this.toolCallRefs.set(callId, { step: stepState, blockIndex: index })
          }
          break
        }
        default:
          return
      }

      stepState.streamBlocks = blocks
      return
    }

    if (
      event.type === 'chunkrow/text-chunks' ||
      event.type === 'chunkrow/reasoning-chunks' ||
      event.type === 'chunkrow/tool-call-chunks'
    ) {
      this.isRunning = true
      const turn = readNumber(data, 'turn') ?? this.turnCounter
      const step = readNumber(data, 'step') ?? this.stepCounter
      const stepState = this.ensureStep(turn, step)
      const index = typeof data.index === 'number' ? data.index : 0
      const blocks = [...stepState.streamBlocks]

      if (event.type === 'chunkrow/text-chunks') {
        const texts = Array.isArray(data.texts) ? data.texts.map(String).join('') : ''
        const prev = blocks[index]
        blocks[index] = {
          kind: 'text',
          text: (prev?.kind === 'text' ? prev.text : '') + texts,
        }
      } else if (event.type === 'chunkrow/reasoning-chunks') {
        const texts = Array.isArray(data.texts) ? data.texts.map(String).join('') : ''
        const prev = blocks[index]
        blocks[index] = {
          kind: 'reasoning',
          text: (prev?.kind === 'reasoning' ? prev.text : '') + texts,
        }
      } else {
        const args = Array.isArray(data.args) ? data.args.map(String).join('') : ''
        const prev = blocks[index]
        const base =
          prev?.kind === 'tool-call'
            ? prev
            : { kind: 'tool-call' as const, toolCallId: '', toolName: '', argsText: '' }
        const callId = base.toolCallId || String(data.id ?? '')
        blocks[index] = {
          kind: 'tool-call',
          toolCallId: callId,
          toolName: typeof data.name === 'string' ? data.name : base.toolName,
          argsText: base.argsText + args,
        }
        if (callId) {
          this.toolCallRefs.set(callId, { step: stepState, blockIndex: index })
        }
      }

      stepState.streamBlocks = blocks
      return
    }

    if (event.type === 'tool/call') {
      this.isRunning = true
      const callId = String(data.callId ?? `call-${String(event.seq)}`)
      const toolName = typeof data.name === 'string' ? data.name : 'tool'
      const argsText = typeof data.arguments === 'string' ? data.arguments : '{}'
      const turn = readNumber(data, 'turn') ?? this.turnCounter
      const step = readNumber(data, 'step') ?? this.stepCounter
      const stepState = this.ensureStep(turn, step)
      const blocks = [...stepState.streamBlocks]
      let blockIndex = blocks.findIndex(
        (b) => b?.kind === 'tool-call' && b.toolCallId === callId,
      )
      if (blockIndex < 0) {
        blockIndex = blocks.length
        blocks.push({ kind: 'tool-call', toolCallId: callId, toolName, argsText })
      } else {
        const existing = blocks[blockIndex]
        if (existing?.kind === 'tool-call') {
          blocks[blockIndex] = { ...existing, toolName, argsText }
        }
      }
      stepState.streamBlocks = blocks
      this.toolCallRefs.set(callId, { step: stepState, blockIndex })
      return
    }

    if (event.type === 'tool/result') {
      const message = (data.message ?? {}) as { toolCallId?: string; content?: unknown }
      const callId = typeof message.toolCallId === 'string' ? message.toolCallId : undefined
      const resultText = textFromContent(message.content)
      const isError = Boolean(data.error)
      if (callId) {
        const ref = this.toolCallRefs.get(callId)
        if (ref) {
          const block = ref.step.streamBlocks[ref.blockIndex]
          if (block?.kind === 'tool-call') {
            ref.step.streamBlocks[ref.blockIndex] = { ...block, result: resultText, isError }
          }
        }
      }
      return
    }

    if (event.type === 'assistant/message') {
      const payload = data as {
        message?: { id?: string; content?: unknown }
        interrupted?: boolean
        turn?: number
        step?: number
      }
      const turn = readNumber(data, 'turn') ?? payload.turn ?? this.turnCounter
      const step = readNumber(data, 'step') ?? payload.step ?? this.stepCounter
      const message = payload.message ?? {}
      const messageId =
        typeof message.id === 'string' ? message.id : `assistant-${turn}-${step}`
      const stepMessageId = `assistant-${turn}-${step}`

      this.finalizeCurrentStep(false)

      const existingIdx = this.messages.findIndex(
        (m) =>
          m.role === 'assistant' && (m.id === messageId || m.id === stepMessageId),
      )

      if (existingIdx >= 0) {
        const existing = this.messages[existingIdx]!
        this.messages[existingIdx] = {
          ...existing,
          id: messageId,
          status: 'complete',
        }
      } else {
        const parts = partsFromAssistantMessage(message)
        this.messages.push({
          id: messageId,
          role: 'assistant',
          content: parts,
          status: 'complete',
        })
      }
      this.stepCounter = Math.max(this.stepCounter, step)
      return
    }

    if (event.type === 'turn/end') {
      this.finalizeCurrentStep(true)
      this.isRunning = false
      return
    }

    if (event.type === 'turn/error') {
      this.finalizeCurrentStep(true)
      this.isRunning = false
      const message =
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        (typeof data.reason === 'string' && data.reason) ||
        'Agent turn failed'
      this.turnError = message
      return
    }

    if (event.type === 'model/selection') {
      const provider = typeof data.provider === 'string' ? data.provider : ''
      const model = typeof data.model === 'string' ? data.model : ''
      const reasoningEffort =
        typeof data.reasoningEffort === 'string' ? data.reasoningEffort : undefined
      if (provider && model) {
        this.modelSelection = {
          provider,
          model,
          ...(reasoningEffort ? { reasoningEffort } : {}),
        }
      }
    }
  }

  getSnapshot(): ChatSnapshot {
    const messages = [...this.messages]
    if (this.currentStep) {
      const parts = blocksToParts(this.currentStep)
      if (parts.length > 0 || this.isRunning) {
        messages.push({
          id: this.currentStep.messageId,
          role: 'assistant',
          content: parts,
          status: this.isRunning ? 'running' : 'complete',
        })
      }
    }
    return {
      messages: messages.filter((m) => m.content.length > 0 || m.role === 'user'),
      isRunning: this.isRunning,
      modelSelection: this.modelSelection,
      ...(this.turnError ? { turnError: this.turnError } : {}),
    }
  }

  private ensureStep(turn: number, step: number): AssistantStepState {
    if (
      this.currentStep &&
      this.currentStep.turn === turn &&
      this.currentStep.step === step
    ) {
      return this.currentStep
    }
    this.finalizeCurrentStep(false)
    this.turnCounter = turn
    this.stepCounter = step
    this.currentStep = {
      turn,
      step,
      messageId: `assistant-${turn}-${step}`,
      contextBlocks: [],
      streamBlocks: [],
    }
    return this.currentStep
  }

  private finalizeCurrentStep(markComplete: boolean): void {
    if (!this.currentStep) return
    const parts = blocksToParts(this.currentStep)
    if (parts.length > 0) {
      const existingIndex = this.messages.findIndex((m) => m.id === this.currentStep!.messageId)
      const msg: ChatMessageDto = {
        id: this.currentStep.messageId,
        role: 'assistant',
        content: parts,
        status: markComplete ? 'complete' : 'complete',
      }
      if (existingIndex >= 0) {
        this.messages[existingIndex] = msg
      } else {
        this.messages.push(msg)
      }
    }
    this.currentStep = null
  }
}

export function projectionFromRecords(records: HistoryRecord[]): ChatSnapshot {
  const projection = new ChatProjection()
  projection.applyRecords(records)
  const snap = projection.getSnapshot()
  if (snap.messages.some((m) => m.status === 'running')) {
    snap.isRunning = false
    for (const m of snap.messages) {
      if (m.status === 'running') m.status = 'complete'
    }
  }
  return snap
}
