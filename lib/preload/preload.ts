import { contextBridge, ipcRenderer } from 'electron'
import type { DshChatEventPayload } from '@/lib/ipc/schemas/chat-schema'

import type { MutateReport } from '@/lib/ipc/schemas/skill-schema'

const ipcApi = {
  dialog: {
    pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory', {}) as Promise<{ path: string | null }>,
  },
  novel: {
    list: () => ipcRenderer.invoke('novel:list'),
    get: (args: { id: string }) => ipcRenderer.invoke('novel:get', args),
    create: (args: { title: string; workspacePath: string }) =>
      ipcRenderer.invoke('novel:create', args),
    update: (args: {
      id: string
      title?: string
      description?: string
      cover?: string
      category?: string
      writingStyleId?: string | null
    }) => ipcRenderer.invoke('novel:update', args),
    delete: (args: { id: string }) => ipcRenderer.invoke('novel:delete', args),
  },
  novelSession: {
    list: (args: { novelId: string }) => ipcRenderer.invoke('novelSession:list', args),
    create: (args: { novelId: string; title?: string }) =>
      ipcRenderer.invoke('novelSession:create', args),
    rename: (args: { id: string; title: string }) =>
      ipcRenderer.invoke('novelSession:rename', args),
    delete: (args: { id: string }) => ipcRenderer.invoke('novelSession:delete', args),
    bindDsh: (args: { id: string; dshSessionId: string }) =>
      ipcRenderer.invoke('novelSession:bindDsh', args),
  },
  novelContext: {
    set: (args: {
      novelId: string | null
      page:
        | 'basic'
        | 'overview'
        | 'world'
        | 'role'
        | 'creature'
        | 'item'
        | 'level'
        | 'timeline'
        | 'outline'
        | 'chapters'
        | 'template'
        | 'skills'
        | null
    }) => ipcRenderer.invoke('novelContext:set', args),
  },
  entity: {
    query: (args: {
      novelId: string
      domain: string
      filter?: Record<string, unknown>
      limit?: number
      offset?: number
      depth?: 'index' | 'full' | 'raw' | number
    }) => ipcRenderer.invoke('entity:query', args),
    get: (args: {
      novelId: string
      domain: string
      ids?: string[]
      names?: string[]
      depth?: 'index' | 'full' | 'raw' | number
    }) => ipcRenderer.invoke('entity:get', args),
    mutate: (args: {
      novelId: string
      ops: Array<{
        domain: string
        action: 'create' | 'update' | 'upsert' | 'delete'
        id?: string
        data?: Record<string, unknown>
      }>
    }) => ipcRenderer.invoke('entity:mutate', args) as Promise<MutateReport>,
    describe: (args: { novelId?: string; domain?: string }) =>
      ipcRenderer.invoke('entity:describe', args),
  },
  dsh: {
    boot: () => ipcRenderer.invoke('dsh:boot', {}),
    getBootInfo: () => ipcRenderer.invoke('dsh:getBootInfo'),
    sessionCreate: () => ipcRenderer.invoke('dsh:sessionCreate'),
    sessionCreateAndBind: (args: { novelSessionId: string }) =>
      ipcRenderer.invoke('dsh:sessionCreateAndBind', args),
    chatLoadHistory: (args: { dshSessionId: string }) =>
      ipcRenderer.invoke('dsh:chatLoadHistory', args),
    chatPrompt: (args: {
      dshSessionId: string
      requestId: string
      text: string
      mode?: 'queue' | 'steer'
    }) => ipcRenderer.invoke('dsh:chatPrompt', args),
    chatCancel: (args: { dshSessionId: string }) => ipcRenderer.invoke('dsh:chatCancel', args),
    chatSubscribe: (args: { dshSessionId: string }) => ipcRenderer.invoke('dsh:chatSubscribe', args),
    chatUnsubscribe: (args: { dshSessionId: string }) =>
      ipcRenderer.invoke('dsh:chatUnsubscribe', args),
    chatExportDebugLog: (args: { dshSessionId: string }) =>
      ipcRenderer.invoke('dsh:chatExportDebugLog', args),
    modelCatalog: () => ipcRenderer.invoke('dsh:modelCatalog'),
    sessionSelectModel: (args: {
      dshSessionId: string
      provider: string
      model: string
      reasoningEffort?: string
    }) => ipcRenderer.invoke('dsh:sessionSelectModel', args),
    sessionGetModelSelection: (args: { dshSessionId: string }) =>
      ipcRenderer.invoke('dsh:sessionGetModelSelection', args),
    onChatEvent: (callback: (payload: DshChatEventPayload) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: DshChatEventPayload) => {
        callback(payload)
      }
      ipcRenderer.on('dsh:chatEvent', listener)
      return () => {
        ipcRenderer.removeListener('dsh:chatEvent', listener)
      }
    },
    offChatEvents: () => {
      ipcRenderer.send('dsh:chatEventsOff')
    },
    settingsDescribe: () => ipcRenderer.invoke('dsh:settingsDescribe'),
    settingsMutate: (args: {
      ns: string
      ops: Array<
        | { op: 'set'; path: string[]; value: unknown }
        | { op: 'delete'; path: string[] }
        | { op: 'unset'; path: string[] }
      >
      expectedRevision?: number
    }) => ipcRenderer.invoke('dsh:settingsMutate', args),
    settingsOpenDocument: () => ipcRenderer.invoke('dsh:settingsOpenDocument'),
    settingsOpenAgentPresetDirectory: (args: { presetId: string }) =>
      ipcRenderer.invoke('dsh:settingsOpenAgentPresetDirectory', args),
    llmListProviders: () => ipcRenderer.invoke('dsh:llmListProviders'),
    llmListConfigurableProviders: () => ipcRenderer.invoke('dsh:llmListConfigurableProviders'),
    agentPresetsList: () => ipcRenderer.invoke('dsh:agentPresetsList'),
    agentPresetsCopy: (args: { from: string; id: string; name?: string }) =>
      ipcRenderer.invoke('dsh:agentPresetsCopy', args),
    agentPresetsDelete: (args: { id: string }) => ipcRenderer.invoke('dsh:agentPresetsDelete', args),
    agentPresetsRead: (args: { id: string }) => ipcRenderer.invoke('dsh:agentPresetsRead', args),
    sessionGetAgentPreset: (args: { dshSessionId: string }) =>
      ipcRenderer.invoke('dsh:sessionGetAgentPreset', args),
    sessionSelectAgentPreset: (args: { dshSessionId: string; presetId: string }) =>
      ipcRenderer.invoke('dsh:sessionSelectAgentPreset', args),
    pluginInventoryList: () => ipcRenderer.invoke('dsh:pluginInventoryList'),
    credentialsDescribe: (args: { refs: string[] }) =>
      ipcRenderer.invoke('dsh:credentialsDescribe', args),
    credentialsSet: (args: { ref: string; value: string }) =>
      ipcRenderer.invoke('dsh:credentialsSet', args),
    credentialsUnset: (args: { ref: string }) => ipcRenderer.invoke('dsh:credentialsUnset', args),
    cursorSubscriptionCall: (args: {
      endpoint:
        | 'status'
        | 'login/start'
        | 'login/status'
        | 'login/cancel'
        | 'logout'
        | 'usage'
        | 'models'
        | 'settings'
        | 'settings/update'
      payload?: Record<string, unknown>
    }) => ipcRenderer.invoke('dsh:cursorSubscriptionCall', args),
  },
  writingStyle: {
    list: () => ipcRenderer.invoke('writingStyle:list'),
  },
  formTemplate: {
    get: (args: { novelId: string }) => ipcRenderer.invoke('formTemplate:get', args),
    update: (args: { novelId: string; config: Record<string, unknown> }) =>
      ipcRenderer.invoke('formTemplate:update', args),
  },
  overview: {
    clear: (args: { novelId: string }) => ipcRenderer.invoke('overview:clear', args),
  },
  skill: {
    initDefaults: (args: { novelId: string }) => ipcRenderer.invoke('skill:initDefaults', args),
    resetDefaults: (args: { novelId: string }) => ipcRenderer.invoke('skill:resetDefaults', args),
  },
  chapterChangeBatch: {
    list: (args: { novelId: string; chapterId?: string }) =>
      ipcRenderer.invoke('chapterChangeBatch:list', args),
    rollback: (args: { novelId: string; batchId: string }) =>
      ipcRenderer.invoke('chapterChangeBatch:rollback', args),
  },
}

contextBridge.exposeInMainWorld('ipcApi', ipcApi)

export type IpcApi = typeof ipcApi
