import { ipcMain, BrowserWindow, dialog } from 'electron'
import { z } from 'zod'
import {
  novelListArgs,
  novelListReturn,
  novelGetArgs,
  novelGetReturn,
  novelCreateArgs,
  novelCreateReturn,
  novelUpdateArgs,
  novelUpdateReturn,
  novelDeleteArgs,
  novelDeleteReturn,
  dialogPickDirectoryArgs,
  dialogPickDirectoryReturn,
  novelSessionListArgs,
  novelSessionListReturn,
  novelSessionCreateArgs,
  novelSessionCreateReturn,
  novelSessionRenameArgs,
  novelSessionRenameReturn,
  novelSessionDeleteArgs,
  novelSessionDeleteReturn,
  novelContextSetArgs,
  novelContextSetReturn,
  entityQueryArgs,
  entityGetArgs,
  entityMutateArgs,
  entityDescribeArgs,
  dshBootReturn,
  dshSessionCreateReturn,
  novelSessionBindDshArgs,
  novelSessionBindDshReturn,
  dshSessionCreateAndBindArgs,
  dshSessionCreateAndBindReturn,
  dshSettingsDescribeReturn,
  dshSettingsMutateArgs,
  dshSettingsMutateReturn,
  dshSettingsOpenDocumentReturn,
  dshSettingsOpenAgentPresetDirectoryArgs,
  dshSettingsOpenAgentPresetDirectoryReturn,
  dshLlmListProvidersReturn,
  dshLlmListConfigurableProvidersReturn,
  dshAgentPresetsListReturn,
  dshAgentPresetsCopyArgs,
  dshAgentPresetsCopyReturn,
  dshAgentPresetsDeleteArgs,
  dshAgentPresetsDeleteReturn,
  dshAgentPresetsReadArgs,
  dshAgentPresetsReadReturn,
  dshSessionGetAgentPresetArgs,
  dshSessionGetAgentPresetReturn,
  dshSessionSelectAgentPresetArgs,
  dshSessionSelectAgentPresetReturn,
  dshPluginInventoryListReturn,
} from '@/lib/ipc/schemas/novel-schema'
import {
  dshModelCatalogReturn,
  dshSessionGetModelSelectionArgs,
  dshSessionGetModelSelectionReturn,
  dshSessionSelectModelArgs,
  dshSessionSelectModelReturn,
} from '@/lib/ipc/schemas/model-schema'
import {
  dshChatLoadHistoryArgs,
  dshChatLoadHistoryReturn,
  dshChatPromptArgs,
  dshChatPromptReturn,
  dshChatCancelArgs,
  dshChatCancelReturn,
  dshChatSubscribeArgs,
  dshChatSubscribeReturn,
  dshChatUnsubscribeArgs,
  dshChatUnsubscribeReturn,
  dshChatExportDebugLogArgs,
  dshChatExportDebugLogReturn,
} from '@/lib/ipc/schemas/chat-schema'
import {
  listNovels,
  getNovel,
  createNovel,
  updateNovel,
  deleteNovel,
} from '@/lib/main/novel/novel-service'
import {
  listNovelSessions,
  createNovelSession,
  renameNovelSession,
  deleteNovelSession,
  bindDshSession,
} from '@/lib/main/novel/session-service'
import { setNovelContext } from '@/lib/main/novel/novel-context'
import { describeDomain, queryEntities, getEntities, mutateEntities } from '@/lib/main/novel/data/entity-repo'
import { ensureDshHostReady, getDshBootInfo } from '@/lib/main/dsh/harness-manager'
import { createAndBindDshSession, createDshSession } from '@/lib/main/dsh/session-bridge'
import {
  cacheSessionModelSelection,
  cancelChat,
  exportChatDebugLog,
  getSessionModelSelection,
  loadChatHistory,
  sendChatPrompt,
  subscribeChatEvents,
  unsubscribeAllForWebContents,
  unsubscribeChatEvents,
} from '@/lib/main/dsh/chat-bridge'
import { getModelCatalog, selectSessionModel } from '@/lib/main/dsh/model-bridge'
import {
  describeDshSettings,
  mutateDshSettings,
  openDshSettingsDocument,
  openDshAgentPresetDirectory,
} from '@/lib/main/dsh/settings-bridge'
import {
  describeDshCredentials,
  setDshCredential,
  unsetDshCredential,
} from '@/lib/main/dsh/credentials-bridge'
import { callCursorSubscription } from '@/lib/main/dsh/cursor-subscription-bridge'
import { listDshLlmProviders, listDshLlmConfigurableProviders } from '@/lib/main/dsh/llm-bridge'
import {
  listDshAgentPresets,
  copyDshAgentPreset,
  deleteDshAgentPreset,
  readDshAgentPreset,
  getSessionAgentPresetState,
  selectSessionAgentPreset,
} from '@/lib/main/dsh/agent-presets-bridge'
import { listDshPluginInventory } from '@/lib/main/dsh/plugin-inventory-bridge'
import {
  clearOverviewBlueprint,
  getFormTemplate,
  updateFormTemplate,
} from '@/lib/main/novel/form-template-service'
import {
  formTemplateGetArgs,
  formTemplateGetReturn,
  formTemplateUpdateArgs,
  formTemplateUpdateReturn,
  overviewClearArgs,
  overviewClearReturn,
} from '@/lib/ipc/schemas/form-template-schema'
import {
  dshCredentialsDescribeArgs,
  dshCredentialsDescribeReturn,
  dshCredentialsSetArgs,
  dshCredentialsSetReturn,
  dshCredentialsUnsetArgs,
  dshCredentialsUnsetReturn,
} from '@/lib/ipc/schemas/credentials-schema'
import {
  cursorSubscriptionCallArgs,
  cursorSubscriptionCallReturn,
} from '@/lib/ipc/schemas/cursor-subscription-schema'
import { listWritingStyles } from '@/lib/main/novel/writing-style-service'
import { initDefaultSkills, resetDefaultSkills } from '@/lib/main/novel/skill-service'
import {
  listChapterChangeBatches,
  rollbackChapterChangeBatch,
} from '@/lib/main/novel/chapter-change-batch-service'
import {
  skillInitDefaultsArgs,
  skillInitDefaultsReturn,
  skillResetDefaultsArgs,
  skillResetDefaultsReturn,
  chapterChangeBatchListArgs,
  chapterChangeBatchListReturn,
  chapterChangeBatchRollbackArgs,
  chapterChangeBatchRollbackReturn,
  entityMutateReturn,
} from '@/lib/ipc/schemas/skill-schema'

let userDataPath = ''

export function setUserDataPath(path: string): void {
  userDataPath = path
}

function handle<A extends z.ZodType, R extends z.ZodType>(
  channel: string,
  argsSchema: A,
  returnSchema: R,
  fn: (args: z.infer<A>, event: Electron.IpcMainInvokeEvent) => Promise<z.infer<R>>,
): void {
  ipcMain.handle(channel, async (event, rawArgs) => {
    const args = argsSchema.parse(rawArgs ?? {})
    const result = await fn(args, event)
    return returnSchema.parse(result)
  })
}

export function registerIpcHandlers(_getMainWindow: () => BrowserWindow | null): void {
  handle('novel:list', novelListArgs, novelListReturn, async () => listNovels())
  handle('novel:get', novelGetArgs, novelGetReturn, async ({ id }) => getNovel(id))
  handle('novel:create', novelCreateArgs, novelCreateReturn, async (input) =>
    createNovel(userDataPath, input),
  )
  handle('novel:update', novelUpdateArgs, novelUpdateReturn, async (input) => updateNovel(input))
  handle('novel:delete', novelDeleteArgs, novelDeleteReturn, async ({ id }) => {
    await deleteNovel(userDataPath, id)
    return { ok: true as const }
  })

  handle('dialog:pickDirectory', dialogPickDirectoryArgs, dialogPickDirectoryReturn, async (_input, event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = await dialog.showOpenDialog(window ?? undefined, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || !result.filePaths[0]) {
      return { path: null }
    }
    return { path: result.filePaths[0] }
  })

  handle('novelSession:list', novelSessionListArgs, novelSessionListReturn, async ({ novelId }) =>
    listNovelSessions(novelId),
  )
  handle('novelSession:create', novelSessionCreateArgs, novelSessionCreateReturn, async (input) =>
    createNovelSession(input),
  )
  handle('novelSession:rename', novelSessionRenameArgs, novelSessionRenameReturn, async (input) =>
    renameNovelSession(input),
  )
  handle('novelSession:delete', novelSessionDeleteArgs, novelSessionDeleteReturn, async ({ id }) => {
    await deleteNovelSession(id)
    return { ok: true as const }
  })

  handle('novelContext:set', novelContextSetArgs, novelContextSetReturn, async (input) => {
    setNovelContext(input)
    return input
  })

  handle('entity:query', entityQueryArgs, z.array(z.record(z.string(), z.unknown())), async (args) =>
    queryEntities(args.novelId, args),
  )
  handle('entity:get', entityGetArgs, z.array(z.record(z.string(), z.unknown())), async (args) =>
    getEntities(args.novelId, args),
  )
  handle('entity:mutate', entityMutateArgs, entityMutateReturn, async (args) =>
    mutateEntities(args.novelId, args.ops),
  )
  handle('entity:describe', entityDescribeArgs, z.array(z.record(z.string(), z.unknown())), async ({ domain, novelId }) =>
    describeDomain(domain, novelId),
  )

  ipcMain.handle('dsh:boot', async () => {
    await ensureDshHostReady(userDataPath)
    return dshBootReturn.parse(getDshBootInfo())
  })

  ipcMain.handle('dsh:getBootInfo', async () => dshBootReturn.parse(getDshBootInfo()))

  ipcMain.handle('dsh:sessionCreate', async () => {
    await ensureDshHostReady(userDataPath)
    const dshSessionId = await createDshSession()
    return dshSessionCreateReturn.parse({ dshSessionId })
  })

  handle('dsh:sessionCreateAndBind', dshSessionCreateAndBindArgs, dshSessionCreateAndBindReturn, async ({ novelSessionId }) => {
    await ensureDshHostReady(userDataPath)
    const dshSessionId = await createAndBindDshSession(novelSessionId)
    return { dshSessionId }
  })

  handle('novelSession:bindDsh', novelSessionBindDshArgs, novelSessionBindDshReturn, async ({ id, dshSessionId }) => {
    await bindDshSession(id, dshSessionId)
    return { ok: true as const }
  })

  handle('dsh:chatLoadHistory', dshChatLoadHistoryArgs, dshChatLoadHistoryReturn, async ({ dshSessionId }) =>
    loadChatHistory(dshSessionId),
  )

  handle('dsh:chatPrompt', dshChatPromptArgs, dshChatPromptReturn, async ({ dshSessionId, requestId, text, mode }) => {
    await sendChatPrompt(dshSessionId, text, requestId, mode ?? 'queue')
    return { accepted: true as const }
  })

  handle('dsh:chatCancel', dshChatCancelArgs, dshChatCancelReturn, async ({ dshSessionId }) => cancelChat(dshSessionId))

  handle('dsh:chatSubscribe', dshChatSubscribeArgs, dshChatSubscribeReturn, async ({ dshSessionId }, event) => {
    subscribeChatEvents(dshSessionId, event.sender)
    return { ok: true as const }
  })

  handle('dsh:chatUnsubscribe', dshChatUnsubscribeArgs, dshChatUnsubscribeReturn, async ({ dshSessionId }, event) => {
    unsubscribeChatEvents(dshSessionId, event.sender)
    return { ok: true as const }
  })

  handle(
    'dsh:chatExportDebugLog',
    dshChatExportDebugLogArgs,
    dshChatExportDebugLogReturn,
    async ({ dshSessionId }) => exportChatDebugLog(dshSessionId),
  )

  ipcMain.handle('dsh:modelCatalog', async () => {
    await ensureDshHostReady(userDataPath)
    return dshModelCatalogReturn.parse(await getModelCatalog())
  })

  handle(
    'dsh:sessionSelectModel',
    dshSessionSelectModelArgs,
    dshSessionSelectModelReturn,
    async ({ dshSessionId, provider, model, reasoningEffort }) => {
      await ensureDshHostReady(userDataPath)
      const selected = await selectSessionModel(dshSessionId, {
        provider,
        model,
        ...(reasoningEffort ? { reasoningEffort } : {}),
      })
      cacheSessionModelSelection(dshSessionId, selected)
      return { selected }
    },
  )

  handle(
    'dsh:sessionGetModelSelection',
    dshSessionGetModelSelectionArgs,
    dshSessionGetModelSelectionReturn,
    async ({ dshSessionId }) => {
      await ensureDshHostReady(userDataPath)
      const selection = await getSessionModelSelection(dshSessionId)
      return { selection }
    },
  )

  ipcMain.handle('dsh:settingsDescribe', async () => {
    await ensureDshHostReady(userDataPath)
    return dshSettingsDescribeReturn.parse(await describeDshSettings())
  })

  handle('dsh:settingsMutate', dshSettingsMutateArgs, dshSettingsMutateReturn, async ({ ns, ops, expectedRevision }) => {
    await ensureDshHostReady(userDataPath)
    return mutateDshSettings(ns, ops, expectedRevision)
  })

  ipcMain.handle('dsh:settingsOpenDocument', async () => {
    await ensureDshHostReady(userDataPath)
    return dshSettingsOpenDocumentReturn.parse(await openDshSettingsDocument())
  })

  handle(
    'dsh:settingsOpenAgentPresetDirectory',
    dshSettingsOpenAgentPresetDirectoryArgs,
    dshSettingsOpenAgentPresetDirectoryReturn,
    async ({ presetId }) => {
      await ensureDshHostReady(userDataPath)
      return openDshAgentPresetDirectory(presetId)
    },
  )

  ipcMain.handle('dsh:llmListProviders', async () => {
    await ensureDshHostReady(userDataPath)
    return dshLlmListProvidersReturn.parse(await listDshLlmProviders())
  })

  ipcMain.handle('dsh:llmListConfigurableProviders', async () => {
    await ensureDshHostReady(userDataPath)
    return dshLlmListConfigurableProvidersReturn.parse(await listDshLlmConfigurableProviders())
  })

  ipcMain.handle('dsh:agentPresetsList', async () => {
    await ensureDshHostReady(userDataPath)
    return dshAgentPresetsListReturn.parse(await listDshAgentPresets())
  })

  handle('dsh:agentPresetsCopy', dshAgentPresetsCopyArgs, dshAgentPresetsCopyReturn, async ({ from, id, name }) => {
    await ensureDshHostReady(userDataPath)
    await copyDshAgentPreset(from, id, name)
    return { ok: true as const }
  })

  handle('dsh:agentPresetsDelete', dshAgentPresetsDeleteArgs, dshAgentPresetsDeleteReturn, async ({ id }) => {
    await ensureDshHostReady(userDataPath)
    await deleteDshAgentPreset(id)
    return { ok: true as const }
  })

  handle('dsh:agentPresetsRead', dshAgentPresetsReadArgs, dshAgentPresetsReadReturn, async ({ id }) => {
    await ensureDshHostReady(userDataPath)
    const content = await readDshAgentPreset(id)
    return { content }
  })

  handle(
    'dsh:sessionGetAgentPreset',
    dshSessionGetAgentPresetArgs,
    dshSessionGetAgentPresetReturn,
    async ({ dshSessionId }) => {
      await ensureDshHostReady(userDataPath)
      return getSessionAgentPresetState(dshSessionId)
    },
  )

  handle(
    'dsh:sessionSelectAgentPreset',
    dshSessionSelectAgentPresetArgs,
    dshSessionSelectAgentPresetReturn,
    async ({ dshSessionId, presetId }) => {
      await ensureDshHostReady(userDataPath)
      const selected = await selectSessionAgentPreset(dshSessionId, presetId)
      return { presetId: selected }
    },
  )

  ipcMain.handle('dsh:pluginInventoryList', async () => {
    await ensureDshHostReady(userDataPath)
    return dshPluginInventoryListReturn.parse(await listDshPluginInventory())
  })

  ipcMain.handle('writingStyle:list', async () => listWritingStyles())

  handle('formTemplate:get', formTemplateGetArgs, formTemplateGetReturn, async ({ novelId }) =>
    getFormTemplate(novelId),
  )

  handle('formTemplate:update', formTemplateUpdateArgs, formTemplateUpdateReturn, async ({ novelId, config }) =>
    updateFormTemplate(novelId, config as import('@/lib/main/novel/data/entity-types').FormTemplateConfig),
  )

  handle('overview:clear', overviewClearArgs, overviewClearReturn, async ({ novelId }) =>
    clearOverviewBlueprint(novelId),
  )

  handle('skill:initDefaults', skillInitDefaultsArgs, skillInitDefaultsReturn, async ({ novelId }) => {
    const skills = await initDefaultSkills(novelId)
    return { skills }
  })

  handle('skill:resetDefaults', skillResetDefaultsArgs, skillResetDefaultsReturn, async ({ novelId }) => {
    const skills = await resetDefaultSkills(novelId)
    return { skills }
  })

  handle('chapterChangeBatch:list', chapterChangeBatchListArgs, chapterChangeBatchListReturn, async ({ novelId, chapterId }) =>
    listChapterChangeBatches(novelId, chapterId),
  )

  handle(
    'chapterChangeBatch:rollback',
    chapterChangeBatchRollbackArgs,
    chapterChangeBatchRollbackReturn,
    async ({ novelId, batchId }) => rollbackChapterChangeBatch(novelId, batchId),
  )

  handle('dsh:credentialsDescribe', dshCredentialsDescribeArgs, dshCredentialsDescribeReturn, async ({ refs }) => {
    await ensureDshHostReady(userDataPath)
    return describeDshCredentials(refs)
  })

  handle('dsh:credentialsSet', dshCredentialsSetArgs, dshCredentialsSetReturn, async ({ ref, value }) => {
    await ensureDshHostReady(userDataPath)
    return setDshCredential(ref, value)
  })

  handle('dsh:credentialsUnset', dshCredentialsUnsetArgs, dshCredentialsUnsetReturn, async ({ ref }) => {
    await ensureDshHostReady(userDataPath)
    return unsetDshCredential(ref)
  })

  handle(
    'dsh:cursorSubscriptionCall',
    cursorSubscriptionCallArgs,
    cursorSubscriptionCallReturn,
    async ({ endpoint, payload }) => {
      await ensureDshHostReady(userDataPath)
      return callCursorSubscription(endpoint, payload)
    },
  )

  ipcMain.on('dsh:chatEventsOff', (event) => {
    unsubscribeAllForWebContents(event.sender)
  })
}
