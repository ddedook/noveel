import { z } from 'zod'

export const chatTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const chatReasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
})

export const chatToolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  argsText: z.string(),
  result: z.string().optional(),
  isError: z.boolean().optional(),
})

export const chatContextInjectionPartSchema = z.object({
  type: z.literal('context-injection'),
  role: z.enum(['inject', 'recall', 'system-prompt']),
  label: z.string(),
  summary: z.string().optional(),
})

export const chatMessagePartSchema = z.union([
  chatTextPartSchema,
  chatReasoningPartSchema,
  chatToolCallPartSchema,
  chatContextInjectionPartSchema,
])

export const chatMessageDtoSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.array(chatMessagePartSchema),
  status: z.enum(['running', 'complete']).optional(),
})

export const modelSelectionDtoSchema = z.object({
  provider: z.string(),
  model: z.string(),
  reasoningEffort: z.string().optional(),
})

export const dshChatLoadHistoryArgs = z.object({ dshSessionId: z.string() })
export const dshChatLoadHistoryReturn = z.object({
  messages: z.array(chatMessageDtoSchema),
  cursor: z.number(),
  isRunning: z.boolean(),
  modelSelection: modelSelectionDtoSchema.optional(),
  turnError: z.string().optional(),
})

export const dshChatPromptArgs = z.object({
  dshSessionId: z.string(),
  requestId: z.string(),
  text: z.string().min(1),
  mode: z.enum(['queue', 'steer']).optional(),
})
export const dshChatPromptReturn = z.object({ accepted: z.literal(true) })

export const dshChatCancelArgs = z.object({ dshSessionId: z.string() })
export const dshChatCancelReturn = z.object({ accepted: z.literal(true) })

export const dshChatSubscribeArgs = z.object({ dshSessionId: z.string() })
export const dshChatSubscribeReturn = z.object({ ok: z.literal(true) })

export const dshChatUnsubscribeArgs = z.object({ dshSessionId: z.string() })
export const dshChatUnsubscribeReturn = z.object({ ok: z.literal(true) })

export type ChatMessageDto = z.infer<typeof chatMessageDtoSchema>
export type ChatMessagePart = z.infer<typeof chatMessagePartSchema>
export type ModelSelectionDto = z.infer<typeof modelSelectionDtoSchema>

export type DshChatEventPayload = {
  dshSessionId: string
  kind: 'snapshot' | 'event' | 'error' | 'done' | 'unknown'
  messages?: ChatMessageDto[]
  isRunning?: boolean
  modelSelection?: ModelSelectionDto
  turnError?: string
  cursor?: number
  event?: Record<string, unknown>
  error?: string
}

export const dshChatExportDebugLogArgs = z.object({ dshSessionId: z.string() })
export const dshChatExportDebugLogReturn = z.object({
  json: z.string(),
})
