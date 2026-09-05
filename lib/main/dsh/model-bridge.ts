import { getHostContext } from '@/lib/main/dsh/host-boot'
import type { ModelSelectionDto } from '@/lib/ipc/schemas/chat-schema'

type ModelReasoningEffort = {
  id: string
  name: string
  description?: string
}

type ModelReasoning = {
  efforts: readonly ModelReasoningEffort[]
  defaultEffort?: string
}

type ModelCatalogModel = {
  id: string
  label?: string
  reasoning?: ModelReasoning
}

type ModelProviderGroup = {
  provider: string
  label?: string
  models: readonly ModelCatalogModel[]
}

type ModelCatalog = {
  providers: readonly ModelProviderGroup[]
  default?: ModelSelectionDto
  failures?: readonly { provider: string; message: string }[]
}

/** Raw shape returned by DSH `SessionController.modelCatalog()`. */
type DshModelCatalog = {
  default?: ModelSelectionDto
  groups: readonly {
    id: string
    name: string
    models: readonly {
      id: string
      name: string
      description?: string
      reasoning?: ModelReasoning
    }[]
  }[]
  failures?: readonly { id: string; name: string; message: string }[]
}

type SessionController = {
  modelCatalog: () => Promise<DshModelCatalog>
  selectModel: (request: {
    sessionId: string
    provider: string
    model: string
    reasoningEffort?: string
  }) => Promise<{ selected: ModelSelectionDto }>
}

function getSessionController(): SessionController {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const controller = ctx.get('sessionController') as SessionController | undefined
  if (!controller?.modelCatalog || !controller.selectModel) {
    throw new Error('DSH session controller unavailable')
  }
  return controller
}

function projectReasoning(reasoning: ModelReasoning | undefined): ModelReasoning | undefined {
  if (!reasoning) return undefined
  return {
    efforts: reasoning.efforts.map((e) => ({
      id: e.id,
      name: e.name,
      ...(e.description ? { description: e.description } : {}),
    })),
    ...(reasoning.defaultEffort ? { defaultEffort: reasoning.defaultEffort } : {}),
  }
}

function projectModelCatalog(raw: DshModelCatalog): ModelCatalog {
  return {
    providers: raw.groups.map((group) => ({
      provider: group.id,
      label: group.name,
      models: group.models.map((model) => ({
        id: model.id,
        label: model.name,
        ...(model.reasoning ? { reasoning: projectReasoning(model.reasoning) } : {}),
      })),
    })),
    ...(raw.default ? { default: raw.default } : {}),
    failures: raw.failures?.map((failure) => ({
      provider: failure.id,
      message: failure.message,
    })),
  }
}

function findCatalogModel(
  catalog: ModelCatalog,
  selection: ModelSelectionDto,
): ModelCatalogModel | undefined {
  for (const group of catalog.providers) {
    if (group.provider !== selection.provider) continue
    const model = group.models.find((m) => m.id === selection.model)
    if (model) return model
  }
  return undefined
}

export function enrichSelectionWithReasoning(
  selection: ModelSelectionDto,
  catalog: ModelCatalog,
): ModelSelectionDto {
  if (selection.reasoningEffort) return selection
  const defaultEffort = findCatalogModel(catalog, selection)?.reasoning?.defaultEffort
  if (!defaultEffort) return selection
  return { ...selection, reasoningEffort: defaultEffort }
}

export async function getModelCatalog(): Promise<ModelCatalog> {
  const raw = await getSessionController().modelCatalog()
  return projectModelCatalog(raw)
}

export async function selectSessionModel(
  sessionId: string,
  selection: ModelSelectionDto,
): Promise<ModelSelectionDto> {
  const result = await getSessionController().selectModel({
    sessionId,
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort ? { reasoningEffort: selection.reasoningEffort } : {}),
  })
  return result.selected
}

export type { ModelCatalog, ModelProviderGroup, ModelCatalogModel, ModelReasoning }
