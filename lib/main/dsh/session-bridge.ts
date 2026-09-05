import { bindDshSession } from '@/lib/main/novel/session-service'
import { getHostContext } from '@/lib/main/dsh/host-boot'
import { cacheSessionModelSelection } from '@/lib/main/dsh/chat-bridge'
import {
  enrichSelectionWithReasoning,
  getModelCatalog,
  selectSessionModel,
} from '@/lib/main/dsh/model-bridge'
import { readSessionDefaults } from '@/lib/main/dsh/session-defaults'

type SessionController = {
  create: (request?: { agentPreset?: string }) => Promise<{ sessionId: string }>
}

export async function createDshSession(): Promise<string> {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')

  const controller = ctx.get('sessionController') as SessionController | undefined
  if (!controller?.create) throw new Error('DSH session controller unavailable')

  const defaults = await readSessionDefaults()
  const createRequest = defaults.agentPreset ? { agentPreset: defaults.agentPreset } : {}
  const result = await controller.create(createRequest)

  const catalog = await getModelCatalog()
  const initialSelection = defaults.model ?? catalog.default
  if (initialSelection) {
    const enriched = enrichSelectionWithReasoning(initialSelection, catalog)
    const selected = await selectSessionModel(result.sessionId, enriched)
    cacheSessionModelSelection(result.sessionId, selected)
  }

  return result.sessionId
}

export async function createAndBindDshSession(novelSessionId: string): Promise<string> {
  const dshSessionId = await createDshSession()
  await bindDshSession(novelSessionId, dshSessionId)
  return dshSessionId
}
