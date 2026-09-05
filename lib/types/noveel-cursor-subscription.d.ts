declare module '@noveel/cursor-subscription' {
  export const CREDENTIAL_REF: unknown
  export const SETTINGS_NAMESPACE: string

  export function resolveCursorSettings(input?: Record<string, unknown>): {
    maxToolRounds: number
    retryCount: number
    retryIntervalMs: number
    retryHttpStatusCodes: readonly number[]
  }

  export class CursorCredentialStore {
    constructor(credentials: unknown, ref: unknown)
  }

  export class CursorAuthService {
    constructor(store: CursorCredentialStore, options?: { logger?: unknown })
  }

  export class CursorLoginCoordinator {
    constructor(auth: CursorAuthService, options?: { logger?: unknown })
  }

  export class CursorUsageReader {
    constructor(auth: CursorAuthService, options?: { logger?: unknown })
    clear(): void
  }

  export class CursorAdapter {
    constructor(options: { auth: CursorAuthService; settings: () => unknown })
    listModelsForRpc(options?: { force?: boolean; signal?: AbortSignal }): Promise<unknown[]>
  }

  export function createCursorRpcHandler(
    coordinator: CursorLoginCoordinator,
    options?: {
      openExternal?: (url: string) => Promise<void> | void
      usageReader?: CursorUsageReader
      modelsProvider?: CursorAdapter
      settings?: {
        read: () => unknown
        update: (patch: Record<string, unknown>, revision: number) => Promise<unknown>
      }
    },
  ): (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>
}
