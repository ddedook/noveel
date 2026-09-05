import { z } from 'zod'
import { modelSelectionDtoSchema } from '@/lib/ipc/schemas/chat-schema'

export const modelReasoningEffortSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
})

export const modelReasoningSchema = z.object({
  efforts: z.array(modelReasoningEffortSchema),
  defaultEffort: z.string().optional(),
})

export const modelCatalogModelSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  reasoning: modelReasoningSchema.optional(),
})

export const modelProviderGroupSchema = z.object({
  provider: z.string(),
  label: z.string().optional(),
  models: z.array(modelCatalogModelSchema),
})

export const dshModelCatalogReturn = z.object({
  providers: z.array(modelProviderGroupSchema),
  default: modelSelectionDtoSchema.optional(),
  failures: z
    .array(z.object({ provider: z.string(), message: z.string() }))
    .optional(),
})

export const dshSessionSelectModelArgs = z.object({
  dshSessionId: z.string(),
  provider: z.string(),
  model: z.string(),
  reasoningEffort: z.string().optional(),
})

export const dshSessionSelectModelReturn = z.object({
  selected: modelSelectionDtoSchema,
})

export const dshSessionGetModelSelectionArgs = z.object({
  dshSessionId: z.string(),
})

export const dshSessionGetModelSelectionReturn = z.object({
  selection: modelSelectionDtoSchema.nullable(),
})

export type ModelCatalogDto = z.infer<typeof dshModelCatalogReturn>
export type ModelProviderGroupDto = z.infer<typeof modelProviderGroupSchema>
export type ModelCatalogModelDto = z.infer<typeof modelCatalogModelSchema>
