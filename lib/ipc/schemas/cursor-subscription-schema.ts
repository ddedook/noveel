import { z } from 'zod'

export const cursorSubscriptionEndpoints = [
  'status',
  'login/start',
  'login/status',
  'login/cancel',
  'logout',
  'usage',
  'models',
  'settings',
  'settings/update',
] as const

export const cursorSubscriptionEndpointSchema = z.enum(cursorSubscriptionEndpoints)

export const cursorSubscriptionCallArgs = z.object({
  endpoint: cursorSubscriptionEndpointSchema,
  payload: z.record(z.string(), z.unknown()).optional().default({}),
})

/** Opaque success payload from the plugin RPC handler. */
export const cursorSubscriptionCallReturn = z.unknown()
