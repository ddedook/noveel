import { shell } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  CursorAdapter,
  CursorAuthService,
  CursorCredentialStore,
  CursorLoginCoordinator,
  CursorUsageReader,
  CREDENTIAL_REF,
  SETTINGS_NAMESPACE,
  createCursorRpcHandler,
  resolveCursorSettings,
} from '@noveel/cursor-subscription'
import { getHostContext } from '@/lib/main/dsh/host-boot'
import type { cursorSubscriptionEndpoints } from '@/lib/ipc/schemas/cursor-subscription-schema'

type CursorEndpoint = (typeof cursorSubscriptionEndpoints)[number]

type RpcResult = { ok: true; value: unknown } | { ok: false; error: { code: string; message: string } }

type CredentialsService = {
  resolve: (ref: unknown) => Promise<{ value?: string } | undefined>
  set: (ref: unknown, value: string) => Promise<void>
  unset: (ref: unknown) => Promise<void>
}

type SettingsService = {
  describe: (opts?: { redactSecrets?: boolean }) => Array<{
    ns: string
    revision?: number
    value?: unknown
  }>
  update: (ns: string, patch: Record<string, unknown>, expectedRevision: number) => Promise<void>
}

type CursorRpcHandler = (
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
) => Promise<RpcResult>

let cachedHandler: CursorRpcHandler | null = null

function getCredentials(): CredentialsService {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const credentials = ctx.get('credentials') as CredentialsService | undefined
  if (!credentials?.resolve || !credentials.set || !credentials.unset) {
    throw new Error('DSH credentials service unavailable')
  }
  return credentials
}

function getSettingsService(): SettingsService {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const settings = ctx.get('settings') as SettingsService | undefined
  if (!settings?.describe || !settings.update) {
    throw new Error('DSH settings service unavailable')
  }
  return settings
}

function buildSettingsController(settings: SettingsService) {
  const readSettingsView = () => {
    const descriptor = settings.describe({ redactSecrets: true }).find((entry) => entry.ns === SETTINGS_NAMESPACE)
    const value = resolveCursorSettings((descriptor?.value as Record<string, unknown> | undefined) ?? {})
    return { ...value, revision: descriptor?.revision ?? 0 }
  }

  return {
    read: readSettingsView,
    update: async (patch: Record<string, unknown>, expectedRevision: number) => {
      resolveCursorSettings({ ...readSettingsView(), ...patch })
      await settings.update(SETTINGS_NAMESPACE, patch, expectedRevision)
      return readSettingsView()
    },
  }
}

function ensureHandler(): CursorRpcHandler {
  if (cachedHandler) return cachedHandler

  const credentials = getCredentials()
  const settings = getSettingsService()
  const store = new CursorCredentialStore(credentials, CREDENTIAL_REF)
  const auth = new CursorAuthService(store)
  const readSettings = () =>
    resolveCursorSettings(
      (settings.describe({ redactSecrets: true }).find((e) => e.ns === SETTINGS_NAMESPACE)?.value as
        | Record<string, unknown>
        | undefined) ?? {},
    )
  const adapter = new CursorAdapter({ auth, settings: readSettings })
  const usageReader = new CursorUsageReader(auth)
  const coordinator = new CursorLoginCoordinator(auth)
  const settingsController = buildSettingsController(settings)

  cachedHandler = createCursorRpcHandler(coordinator, {
    // Electron opens the browser; keep plugin spawn opener unused.
    openExternal: undefined,
    usageReader,
    modelsProvider: adapter,
    settings: settingsController,
  }) as CursorRpcHandler

  return cachedHandler
}

function unwrap(result: RpcResult): unknown {
  if (result.ok === true) return result.value
  throw new Error(result.error.message || `Cursor request failed (${result.error.code})`)
}

/**
 * Call the Cursor subscription RPC surface in-process.
 * Host Connection has no rpc.call; we build the same handler the plugin registers.
 * Credentials are shared with the Cordis-registered LLM adapter via CURSOR_SUBSCRIPTION_OAUTH.
 */
export async function callCursorSubscription(
  endpoint: CursorEndpoint,
  payload: Record<string, unknown> = {},
): Promise<unknown> {
  const handler = ensureHandler()
  const controller = new AbortController()

  if (endpoint === 'login/start') {
    const started = unwrap(
      await handler('login/start', { ...payload, openExternal: false }, controller.signal),
    ) as { authUrl?: string; externalOpened?: boolean; [key: string]: unknown }

    const authUrl = typeof started.authUrl === 'string' ? started.authUrl : undefined
    if (!authUrl) {
      return { ...started, externalOpened: false }
    }

    try {
      await shell.openExternal(authUrl)
      return { ...started, externalOpened: true }
    } catch {
      return { ...started, externalOpened: false }
    }
  }

  // Correlation id unused by handler but keeps AbortSignal shape consistent.
  void randomUUID()
  return unwrap(await handler(endpoint, payload, controller.signal))
}

/** Drop cached handler after host restart. */
export function resetCursorSubscriptionBridge(): void {
  cachedHandler = null
}
