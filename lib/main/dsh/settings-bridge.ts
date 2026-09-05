import { getHostContext } from '@/lib/main/dsh/host-boot'

type SettingsMutationOpIn =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'delete'; path: string[] }
  | { op: 'unset'; path: string[] }

type SettingsMutationOpWire =
  | { op: 'set'; path: string[]; value: unknown }
  | { op: 'unset'; path: string[] }

type SettingsController = {
  describe: () => Promise<{
    writable: boolean
    hasDocument: boolean
    namespaces: Array<Record<string, unknown>>
  }>
  mutate: (
    ns: string,
    ops: SettingsMutationOpWire[],
    expectedRevision?: number,
  ) => Promise<Record<string, unknown>>
  openSettingsDocument: (signal?: AbortSignal) => Promise<{ opened: true }>
  openAgentPresetDirectory: (agentPreset: string, signal?: AbortSignal) => Promise<{ opened: true }>
}

function getSettingsController(): SettingsController {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const controller = ctx.get('settingsController') as SettingsController | undefined
  if (!controller?.describe) throw new Error('DSH settings controller unavailable')
  return controller
}

function normalizeOps(ops: SettingsMutationOpIn[]): SettingsMutationOpWire[] {
  return ops.map((op) => {
    if (op.op === 'delete') return { op: 'unset', path: op.path }
    return op
  })
}

export async function describeDshSettings(): Promise<{
  writable: boolean
  hasDocument: boolean
  namespaces: Array<Record<string, unknown>>
}> {
  return getSettingsController().describe()
}

export async function mutateDshSettings(
  ns: string,
  ops: SettingsMutationOpIn[],
  expectedRevision?: number,
): Promise<Record<string, unknown>> {
  return getSettingsController().mutate(ns, normalizeOps(ops), expectedRevision)
}

export async function openDshSettingsDocument(): Promise<{ opened: true }> {
  return getSettingsController().openSettingsDocument()
}

export async function openDshAgentPresetDirectory(presetId: string): Promise<{ opened: true }> {
  return getSettingsController().openAgentPresetDirectory(presetId)
}
