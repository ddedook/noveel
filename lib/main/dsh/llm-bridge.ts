import { getHostContext } from '@/lib/main/dsh/host-boot'

type LlmProviderInfo = { id: string; name: string }

type LlmConfigurableProvider = {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: readonly string[]
  declared?: boolean
}

type LlmService = {
  listProviders: () => LlmProviderInfo[]
  listConfigurableProviders: () => LlmConfigurableProvider[]
}

function getLlmService(): LlmService {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const llm = ctx.get('llm') as LlmService | undefined
  if (!llm?.listProviders || !llm.listConfigurableProviders) {
    throw new Error('DSH LLM service unavailable')
  }
  return llm
}

export async function listDshLlmProviders(): Promise<LlmProviderInfo[]> {
  return getLlmService().listProviders()
}

export async function listDshLlmConfigurableProviders(): Promise<LlmConfigurableProvider[]> {
  return getLlmService().listConfigurableProviders()
}

export type { LlmProviderInfo, LlmConfigurableProvider }
