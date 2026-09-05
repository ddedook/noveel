import { getHostContext } from '@/lib/main/dsh/host-boot'
import { readSessionDefaults } from '@/lib/main/dsh/session-defaults'

type SessionEvent = {
  type: string
  data?: unknown
}

type Agent = {
  session: { events: readonly SessionEvent[] }
}

type SessionController = {
  inspect: (sessionId: string) => Promise<{ meta: unknown; events: readonly SessionEvent[] }>
  resolveAgent: (sessionId: string) => Promise<{ agent?: Agent; error?: { message?: string } }>
}

type SessionProjections = {
  stateOf: (session: { events: readonly SessionEvent[] }, key: string) => unknown
}

type AgentPresetRosterEntry = {
  id: string
  trust: 'system' | 'user'
  isDefault: boolean
  name?: string
  description?: string
  broken?: string
}

type AgentPresetRoster = {
  presets: readonly AgentPresetRosterEntry[]
  authorable: boolean
}

type AgentPresetsService = {
  remoteExportList: () => Promise<AgentPresetRoster>
  select: (agent: Agent, agentPreset: string) => Promise<string>
  copy: (from: string, id: string, name?: string) => Promise<void>
  deletePreset: (id: string) => Promise<void>
  read: (id: string) => Promise<string>
}

export type SessionAgentPresetState = {
  presetId: string | null
  locked: boolean
}

function getSessionController(): SessionController {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const controller = ctx.get('sessionController') as SessionController | undefined
  if (!controller?.inspect || !controller.resolveAgent) {
    throw new Error('DSH session controller unavailable')
  }
  return controller
}

function getSessionProjections(): SessionProjections | undefined {
  const ctx = getHostContext()
  if (ctx === null) return undefined
  return ctx.get('sessionProjections') as SessionProjections | undefined
}

function isSessionLocked(events: readonly SessionEvent[]): boolean {
  return events.some((event) => event.type === 'turn/start')
}

function presetFromEvents(events: readonly SessionEvent[]): string | undefined {
  let preset: string | undefined
  for (const event of events) {
    if (event.type !== 'agent-preset/selected') continue
    const data = event.data as { agentPreset?: string } | undefined
    if (typeof data?.agentPreset === 'string') preset = data.agentPreset
  }
  return preset
}

async function resolvePresetId(
  sessionId: string,
  events: readonly SessionEvent[],
): Promise<string | null> {
  const fromEvents = presetFromEvents(events)
  if (fromEvents) return fromEvents

  const projections = getSessionProjections()
  const resolved = await getSessionController().resolveAgent(sessionId)
  if (resolved.agent && projections) {
    const projected = projections.stateOf(resolved.agent.session, 'agentPreset')
    if (typeof projected === 'string') return projected
  }

  const roster = await listDshAgentPresets()
  const defaults = await readSessionDefaults()
  if (defaults.agentPreset) return defaults.agentPreset
  return roster.presets.find((p) => p.isDefault)?.id ?? roster.presets[0]?.id ?? null
}

function getAgentPresetsService(): AgentPresetsService {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const service = ctx.get('agentPresets') as AgentPresetsService | undefined
  if (!service?.remoteExportList) throw new Error('DSH agent presets service unavailable')
  return service
}

export async function listDshAgentPresets(): Promise<AgentPresetRoster> {
  return getAgentPresetsService().remoteExportList()
}

export async function copyDshAgentPreset(from: string, id: string, name?: string): Promise<void> {
  await getAgentPresetsService().copy(from, id, name)
}

export async function deleteDshAgentPreset(id: string): Promise<void> {
  const service = getAgentPresetsService()
  if (!service.deletePreset) throw new Error('DSH agent preset delete unavailable')
  await service.deletePreset(id)
}

export async function readDshAgentPreset(id: string): Promise<string> {
  return getAgentPresetsService().read(id)
}

export async function getSessionAgentPresetState(
  sessionId: string,
): Promise<SessionAgentPresetState> {
  const inspected = await getSessionController().inspect(sessionId)
  const locked = isSessionLocked(inspected.events)
  const presetId = await resolvePresetId(sessionId, inspected.events)
  return { presetId, locked }
}

export async function selectSessionAgentPreset(
  sessionId: string,
  presetId: string,
): Promise<string> {
  const controller = getSessionController()
  const resolved = await controller.resolveAgent(sessionId)
  if (!resolved.agent) {
    throw new Error(resolved.error?.message ?? `Session "${sessionId}" not found`)
  }
  if (isSessionLocked(resolved.agent.session.events)) {
    throw new Error('Agent preset is locked after the conversation has started')
  }
  return getAgentPresetsService().select(resolved.agent, presetId)
}

export type { AgentPresetRoster, AgentPresetRosterEntry }
