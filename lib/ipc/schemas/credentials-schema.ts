import { z } from 'zod'

export const dshCredentialsDescribeArgs = z.object({
  refs: z.array(z.string()),
})
export const dshCredentialsDescribeReturn = z.record(z.string(), z.string())

export const dshCredentialsSetArgs = z.object({
  ref: z.string(),
  value: z.string(),
})
export const dshCredentialsSetReturn = z.object({ ok: z.literal(true) })

export const dshCredentialsUnsetArgs = z.object({
  ref: z.string(),
})
export const dshCredentialsUnsetReturn = z.object({ ok: z.literal(true) })
