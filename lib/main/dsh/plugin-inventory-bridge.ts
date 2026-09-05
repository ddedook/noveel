import { getHostContext } from '@/lib/main/dsh/host-boot'

type PluginInventoryEntry = {
  entryId: string
  moduleName: string
  enabled: boolean
  fiberPhase: string | null
}

type PluginInventorySnapshot = {
  entries: readonly PluginInventoryEntry[]
}

type PluginInventoryService = {
  list: () => PluginInventorySnapshot
}

function getPluginInventoryService(): PluginInventoryService {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const service = ctx.get('pluginInventory') as PluginInventoryService | undefined
  if (!service?.list) throw new Error('DSH plugin inventory service unavailable')
  return service
}

export async function listDshPluginInventory(): Promise<PluginInventorySnapshot> {
  const snapshot = getPluginInventoryService().list()
  return {
    entries: snapshot.entries.map((entry) => ({
      entryId: String(entry.entryId),
      moduleName: entry.moduleName,
      enabled: entry.enabled,
      fiberPhase: entry.fiberPhase,
    })),
  }
}

export type { PluginInventoryEntry, PluginInventorySnapshot }
