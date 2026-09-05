import { describeDshSettings } from '@/lib/main/dsh/settings-bridge'

const AGENT_DEFAULT_MODEL_NS = 'agent-default-model'

export type SessionDefaults = {
  agentPreset?: string
  model?: { provider: string; model: string }
}

function namespaceValue(
  namespaces: Array<Record<string, unknown>>,
  id: string,
): Record<string, unknown> | undefined {
  const ns = namespaces.find((n) => n.id === id)
  const value = ns?.value
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export async function readSessionDefaults(): Promise<SessionDefaults> {
  try {
    const snap = await describeDshSettings()
    const presets = namespaceValue(snap.namespaces, 'agent-presets')
    const modelNs = namespaceValue(snap.namespaces, AGENT_DEFAULT_MODEL_NS)

    const agentPreset =
      typeof presets?.default === 'string' && presets.default.trim()
        ? presets.default.trim()
        : undefined

    const provider =
      typeof modelNs?.provider === 'string' ? modelNs.provider.trim() : ''
    const model = typeof modelNs?.['model-id'] === 'string' ? modelNs['model-id'].trim() : ''

    return {
      agentPreset,
      model: provider && model ? { provider, model } : undefined,
    }
  } catch {
    return {}
  }
}
