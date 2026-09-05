import { z } from 'zod'

export const skillInitDefaultsArgs = z.object({ novelId: z.string() })
export const skillInitDefaultsReturn = z.object({ skills: z.array(z.record(z.string(), z.unknown())) })

export const skillResetDefaultsArgs = z.object({ novelId: z.string() })
export const skillResetDefaultsReturn = z.object({ skills: z.array(z.record(z.string(), z.unknown())) })

export const chapterChangeBatchListArgs = z.object({
  novelId: z.string(),
  chapterId: z.string().optional(),
})
export const chapterChangeBatchListReturn = z.array(
  z.object({
    id: z.string(),
    novelId: z.string(),
    chapterId: z.string(),
    summary: z.string(),
    ops: z.array(z.record(z.string(), z.unknown())),
    chapterBefore: z.record(z.string(), z.unknown()).nullable(),
    createdAt: z.string(),
    rolledBackAt: z.string().nullable(),
  }),
)

export const chapterChangeBatchRollbackArgs = z.object({
  novelId: z.string(),
  batchId: z.string(),
})
export const chapterChangeBatchRollbackReturn = chapterChangeBatchListReturn.element

export const entityMutateReturn = z.object({
  ok: z.boolean(),
  applied: z.number(),
  failed: z.number(),
  results: z.array(z.unknown()),
  retryGuidance: z.string().optional(),
})

export type MutateReport = z.infer<typeof entityMutateReturn>
