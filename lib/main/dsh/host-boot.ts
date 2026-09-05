import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { noveelAppRoot } from '@/lib/main/dsh/app-root'
import { clearStaleDshFileLocks } from '@/lib/main/dsh/dsh-lock-cleanup'
import { registerVendorModulePaths, importVendorModule, vendorRequire } from '@/lib/main/dsh/vendor-module-paths'
import { registerNoveelTools } from '@/lib/main/dsh/noveel-tools'

type DshHostContext = {
  get(name: string): { port?: number; await?: () => Promise<void> } | undefined
  fiber: { dispose: () => Promise<void> }
}

const BIN_NAME = 'noveel'
const PROFILE_ROOT_FILENAME = 'cordis.yml'
const PROFILE_ROOT_CONFIG = '[]\n'

let hostContext: DshHostContext | null = null

export function getHostContext(): DshHostContext | null {
  return hostContext
}

function noveelRoot(): string {
  return noveelAppRoot()
}

function isAddrInUse(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const code = (error as { code?: string }).code
  if (code === 'EADDRINUSE') return true
  const cause = (error as { cause?: unknown }).cause
  return isAddrInUse(cause)
}

function isLockTimeout(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.message.includes('timed out waiting for the writer lock')) return true
    return isLockTimeout(error.cause)
  }
  return false
}

function isRetriableBootError(error: unknown): boolean {
  return isAddrInUse(error) || isLockTimeout(error)
}

async function buildBootResult(ctx: DshHostContext): Promise<{ url: string; authUrl: string; ready: boolean }> {
  const port = await waitForWebServer(ctx)
  const baseUrl = `http://127.0.0.1:${String(port)}/`
  const connection = ctx.get('connection') as { authenticatedUrl: (url: string) => string } | undefined
  const authUrl = connection?.authenticatedUrl(baseUrl) ?? baseUrl
  return { url: baseUrl, authUrl, ready: true }
}

export async function bootNoveelHost(userData: string): Promise<{ url: string; authUrl: string; ready: boolean }> {
  registerVendorModulePaths()

  const {
    boot,
    healProfilesModuleFallback,
    loadOverlayPatches,
    loadProfile,
  } = await importVendorModule<{
    boot: (
      bin: string,
      rootConfig: string,
      patches: unknown[],
      onReady: (ctx: unknown) => void | Promise<void>,
      bareModuleBaseUrl: string,
    ) => Promise<DshHostContext>
    healProfilesModuleFallback: (args: {
      installAnchor: string
      profile: { dir: string; layers: { patches: unknown[] }[]; patches: unknown[] }
    }) => Promise<void>
    loadOverlayPatches: (bin: string, path: string) => unknown[] | null
    loadProfile: (bin: string, profile: string, installAnchor: string) => {
      dir: string
      layers: { patches: unknown[] }[]
      patches: unknown[]
    }
  }>('@deepseek-ai/dsh-app-boot')

  process.env.DSH_HOME = join(userData, 'dsh')
  const dshHome = process.env.DSH_HOME
  await clearStaleDshFileLocks(dshHome)

  const installAnchor = vendorRequire().resolve('@deepseek-ai/dsh/package.json')
  const profile = loadProfile(BIN_NAME, 'web', installAnchor)
  await healProfilesModuleFallback({ installAnchor, profile })

  const rootConfig = join(profile.dir, PROFILE_ROOT_FILENAME)
  writeFileSync(rootConfig, PROFILE_ROOT_CONFIG)

  const patchPath = join(noveelRoot(), 'cordis/noveel.patch.yml')
  const noveelPatches = loadOverlayPatches(BIN_NAME, patchPath) ?? []
  const bundlePatches = profile.layers.flatMap((layer) => layer.patches)
  const patches = [...bundlePatches, ...profile.patches, ...noveelPatches]
  const bareModuleBaseUrl = pathToFileURL(join(noveelRoot(), 'package.json')).href

  const { provideCmdline } = await importVendorModule<{
    provideCmdline: (
      ctx: unknown,
      host: { args: string[]; exit: (code?: number) => void },
    ) => void
  }>('@deepseek-ai/dsh-cmdline')

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctx = await boot(
        BIN_NAME,
        rootConfig,
        patches,
        async (hostCtx) => {
          provideCmdline(hostCtx, {
            // Port 0 lets the OS assign a free port, avoiding EADDRINUSE races.
            args: ['--no-open', '--port', '0'],
            exit: () => {},
          })
        },
        bareModuleBaseUrl,
      )

      hostContext = ctx
      await ctx.get('loader')?.await()
      await registerNoveelTools(ctx as unknown as Parameters<typeof registerNoveelTools>[0])
      return await buildBootResult(ctx)
    } catch (error) {
      lastError = error
      await stopNoveelHost()
      if (isLockTimeout(error)) {
        await clearStaleDshFileLocks(dshHome)
      }
      if (!isRetriableBootError(error) || attempt === 2) throw error
      await new Promise((r) => setTimeout(r, 300))
    }
  }

  throw lastError instanceof Error ? lastError : new Error('DSH host boot failed')
}

async function waitForWebServer(ctx: DshHostContext, timeoutMs = 30_000): Promise<number> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const port = ctx.get('webServer')?.port
    if (typeof port === 'number' && port > 0) return port
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`${BIN_NAME}: webServer did not bind within ${String(timeoutMs)}ms`)
}

export async function recoverHostBootInfo(): Promise<{ url: string; authUrl: string; ready: boolean } | null> {
  const ctx = hostContext
  if (ctx === null) return null
  try {
    return await buildBootResult(ctx)
  } catch {
    return null
  }
}

export async function stopNoveelHost(): Promise<void> {
  if (hostContext === null) return
  await hostContext.fiber.dispose()
  hostContext = null
  const { resetCursorSubscriptionBridge } = await import('@/lib/main/dsh/cursor-subscription-bridge')
  resetCursorSubscriptionBridge()
}
