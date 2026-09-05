import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import {
  AlertDialog,
  Button,
  Card,
  Chip,
  Disclosure,
  Input,
  Label,
  TextArea,
  TextField,
} from '@heroui/react'
import type { DshSettingsSnapshot } from '@/app/hooks/use-dsh-settings'
import { namespaceMap, useSettingsNamespace } from '@/app/hooks/use-dsh-settings'
import {
  SETTINGS_PORTAL_LAYER,
  SettingsSelect,
} from '@/app/components/layout/settings-ui'
import {
  AGENT_DEFAULT_MODEL_NS,
  CUSTOM_PROVIDER_PROTOCOLS,
  CUSTOM_PROVIDER_ROUTE_PATTERN,
  LLM_PI_AI_NS,
} from '@/app/lib/settings-constants'
import {
  buildProviderRows,
  deriveKeyRef,
  joinProviderDirectory,
  providerUsable,
  type ProviderRow,
} from '@/app/lib/dsh-models'
import { toast } from '@/app/lib/toast'
import { cn } from '@/app/lib/utils'

type SettingsModelsSectionProps = {
  snapshot: DshSettingsSnapshot
  onReload: () => void
}

function parseModelIds(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
}

function ApiKeyField(props: {
  value: string
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <TextField
      value={props.value}
      onChange={props.onChange}
      isDisabled={props.disabled}
      className="w-full"
    >
      <Label>API Key</Label>
      <Input type="password" placeholder={props.placeholder ?? 'sk-...'} />
    </TextField>
  )
}

export function SettingsModelsSection({ snapshot, onReload }: SettingsModelsSectionProps) {
  const llmSettings = useSettingsNamespace(snapshot, LLM_PI_AI_NS, onReload)
  const defaultModelSettings = useSettingsNamespace(snapshot, AGENT_DEFAULT_MODEL_NS, onReload)

  const [rows, setRows] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [editKeyDraft, setEditKeyDraft] = useState('')
  const [savingKey, setSavingKey] = useState(false)

  const [adding, setAdding] = useState(false)
  const [addProviderId, setAddProviderId] = useState('')
  const [addKeyDraft, setAddKeyDraft] = useState('')
  const [savingAdd, setSavingAdd] = useState(false)

  const [declaring, setDeclaring] = useState(false)
  const [customRoute, setCustomRoute] = useState('')
  const [customDisplayName, setCustomDisplayName] = useState('')
  const [customBaseUrl, setCustomBaseUrl] = useState('')
  const [customProtocol, setCustomProtocol] = useState<string>(
    CUSTOM_PROVIDER_PROTOCOLS[0]?.value ?? 'openai-completions',
  )
  const [customModels, setCustomModels] = useState('')
  const [customKeyDraft, setCustomKeyDraft] = useState('')
  const [savingCustom, setSavingCustom] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null)

  const nsMap = useMemo(() => namespaceMap(snapshot.namespaces), [snapshot.namespaces])

  const loadProviders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [registered, configurable] = await Promise.all([
        window.ipcApi.dsh.llmListProviders(),
        window.ipcApi.dsh.llmListConfigurableProviders(),
      ])
      const entries = joinProviderDirectory(registered, configurable)
      const refs = [
        ...new Set(
          entries.flatMap((entry) => {
            const ns = entry.settingsNs ? nsMap.get(entry.settingsNs) : undefined
            const profilePath = entry.settingsPath
            const env =
              ns && profilePath.length >= 0
                ? (() => {
                    let profile: unknown = ns.value
                    for (const key of profilePath) {
                      if (profile == null || typeof profile !== 'object') return undefined
                      profile = (profile as Record<string, unknown>)[key]
                    }
                    if (typeof profile === 'object' && profile !== null) {
                      const ref = (profile as Record<string, unknown>).apiKeyEnv
                      return typeof ref === 'string' ? ref : undefined
                    }
                    return undefined
                  })()
                : undefined
            return [env ?? deriveKeyRef(entry.provider)]
          }),
        ),
      ]
      const credentials =
        refs.length > 0 ? await window.ipcApi.dsh.credentialsDescribe({ refs }) : {}
      const built = buildProviderRows(
        entries,
        new Map(
          [...nsMap.entries()].map(([k, v]) => [
            k,
            { value: v.value, user: v.user, base: v.base },
          ]),
        ),
        credentials,
      )
      setRows(built)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载模型配置失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [nsMap])

  useEffect(() => {
    void loadProviders(rows.length > 0)
  }, [loadProviders, snapshot])

  const configuredRows = useMemo(() => rows.filter((row) => row.configured), [rows])
  const addable = useMemo(
    () => rows.filter((row) => !row.configured && row.entry.settingsNs !== ''),
    [rows],
  )
  const takenRoutes = useMemo(() => rows.map((row) => row.entry.provider), [rows])

  const defaultProvider = String(
    (defaultModelSettings.namespace?.value as { provider?: string } | undefined)?.provider ?? '',
  )
  const defaultModel = String(
    (defaultModelSettings.namespace?.value as { model?: string } | undefined)?.model ?? '',
  )

  const customRouteInvalid =
    customRoute.length > 0 && !CUSTOM_PROVIDER_ROUTE_PATTERN.test(customRoute)
  const customRouteTaken = customRoute.length > 0 && takenRoutes.includes(customRoute)
  const customModelIds = parseModelIds(customModels)
  const customReady =
    customRoute.length > 0 &&
    !customRouteInvalid &&
    !customRouteTaken &&
    customBaseUrl.trim().length > 0 &&
    customModelIds.length > 0

  function closeAdding() {
    setAdding(false)
    setAddProviderId('')
    setAddKeyDraft('')
  }

  function closeDeclaring() {
    setDeclaring(false)
    setCustomRoute('')
    setCustomDisplayName('')
    setCustomBaseUrl('')
    setCustomProtocol(CUSTOM_PROVIDER_PROTOCOLS[0]?.value ?? 'openai-completions')
    setCustomModels('')
    setCustomKeyDraft('')
  }

  function toggleAdding() {
    if (adding) {
      closeAdding()
      return
    }
    closeDeclaring()
    setEditingProvider(null)
    const first = addable[0]
    if (first) setAddProviderId(first.entry.provider)
    setAdding(true)
  }

  function toggleDeclaring() {
    if (declaring) {
      closeDeclaring()
      return
    }
    closeAdding()
    setEditingProvider(null)
    setDeclaring(true)
  }

  async function handleSaveEditKey(row: ProviderRow) {
    const ref = row.apiKeyEnv ?? deriveKeyRef(row.entry.provider)
    if (!editKeyDraft || editKeyDraft.includes('•')) return
    setSavingKey(true)
    try {
      await window.ipcApi.dsh.credentialsSet({ ref, value: editKeyDraft })
      toast.success('API Key 已保存')
      setEditingProvider(null)
      setEditKeyDraft('')
      onReload()
      await loadProviders(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '保存 API Key 失败')
    } finally {
      setSavingKey(false)
    }
  }

  async function handleAddCatalogProvider() {
    if (!addProviderId || !snapshot.writable) return
    const row = addable.find((item) => item.entry.provider === addProviderId)
    if (!row) return
    const keyValue = addKeyDraft.trim()
    if (!keyValue) {
      toast.error('请输入 API Key')
      return
    }
    const { entry } = row
    const ns = entry.settingsNs || LLM_PI_AI_NS
    const path = entry.settingsPath.length > 0 ? [...entry.settingsPath] : ['providers', entry.provider]
    const keyRef = deriveKeyRef(entry.provider)
    const revision = snapshot.namespaces.find((n) => n.ns === ns)?.revision
    setSavingAdd(true)
    try {
      await window.ipcApi.dsh.settingsMutate({
        ns,
        ops: [{ op: 'set', path, value: { apiKeyEnv: keyRef } }],
        expectedRevision: revision,
      })
      await window.ipcApi.dsh.credentialsSet({ ref: keyRef, value: keyValue })
      toast.success('已添加提供方')
      closeAdding()
      onReload()
      await loadProviders(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加提供方失败')
    } finally {
      setSavingAdd(false)
    }
  }

  async function handleAddCustomProvider() {
    if (!customReady || !snapshot.writable) return
    const route = customRoute.trim()
    const keyRef = deriveKeyRef(route)
    const keyValue = customKeyDraft.trim()
    const profile: Record<string, unknown> = {
      api: customProtocol,
      baseURL: customBaseUrl.trim(),
      models: customModelIds.map((id) => ({ id })),
    }
    const displayName = customDisplayName.trim()
    if (displayName.length > 0) profile.displayName = displayName
    if (keyValue.length > 0) profile.apiKeyEnv = keyRef
    const revision = llmSettings.namespace?.revision
    setSavingCustom(true)
    try {
      await window.ipcApi.dsh.settingsMutate({
        ns: LLM_PI_AI_NS,
        ops: [{ op: 'set', path: ['providers', route], value: profile }],
        expectedRevision: revision,
      })
      if (keyValue.length > 0) {
        await window.ipcApi.dsh.credentialsSet({ ref: keyRef, value: keyValue })
      }
      toast.success('已添加自定义提供方')
      closeDeclaring()
      onReload()
      await loadProviders(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '添加自定义提供方失败')
    } finally {
      setSavingCustom(false)
    }
  }

  async function handleDeleteProvider() {
    if (!deleteTarget || !llmSettings.writable) return
    const { entry, apiKeyEnv } = deleteTarget
    try {
      if (entry.settingsNs && entry.settingsPath.length > 0) {
        await window.ipcApi.dsh.settingsMutate({
          ns: entry.settingsNs,
          ops: [{ op: 'unset', path: [...entry.settingsPath] }],
          expectedRevision: llmSettings.namespace?.revision,
        })
      }
      const ref = apiKeyEnv ?? deriveKeyRef(entry.provider)
      await window.ipcApi.dsh.credentialsUnset({ ref }).catch(() => {})
      toast.success('已删除提供方')
      setDeleteTarget(null)
      onReload()
      await loadProviders(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除提供方失败')
    }
  }

  if (loading && rows.length === 0) {
    return <p className="text-muted text-sm">加载中…</p>
  }

  const addTarget = adding ? addable.find((row) => row.entry.provider === addProviderId) : undefined

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted text-sm">填入各提供方的 API 密钥即可使用其模型。</p>
      {error ? <p className="text-danger text-sm">{error}</p> : null}

      <Card>
        <Card.Header>
          <Card.Title>默认模型（Agent）</Card.Title>
        </Card.Header>
        <Card.Content>
          <div className="flex flex-row flex-wrap gap-2">
            <TextField
              className="min-w-35 flex-1"
              value={defaultProvider}
              isDisabled={!defaultModelSettings.writable}
              onChange={(value) => void defaultModelSettings.mutate(['provider'], value)}
            >
              <Input placeholder="provider" />
            </TextField>
            <TextField
              className="min-w-35 flex-1"
              value={defaultModel}
              isDisabled={!defaultModelSettings.writable}
              onChange={(value) => void defaultModelSettings.mutate(['model'], value)}
            >
              <Input placeholder="model-id" />
            </TextField>
          </div>
        </Card.Content>
      </Card>

      <div className="flex flex-col gap-3">
        {configuredRows.map((row) => {
          const open = editingProvider === row.entry.provider
          return (
            <Disclosure
              key={row.entry.provider}
              isExpanded={open}
              onExpandedChange={(expanded) => {
                if (!expanded) {
                  setEditingProvider(null)
                  setEditKeyDraft('')
                }
              }}
            >
              <Card>
                <Card.Header className="flex-row items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        providerUsable(row) ? 'bg-green-500' : 'bg-default',
                      )}
                    />
                    <Card.Title className="truncate">{row.entry.displayName}</Card.Title>
                    {row.entry.declared ? (
                      <Chip variant="secondary">自定义</Chip>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isDisabled={!snapshot.writable}
                      onPress={() => {
                        if (open) {
                          setEditingProvider(null)
                          setEditKeyDraft('')
                          return
                        }
                        closeAdding()
                        closeDeclaring()
                        setEditingProvider(row.entry.provider)
                        setEditKeyDraft(row.credential?.masked ?? '')
                      }}
                    >
                      {open ? '收起' : '编辑'}
                    </Button>
                    {row.removable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-danger"
                        isDisabled={!snapshot.writable}
                        onPress={() => setDeleteTarget(row)}
                      >
                        删除
                      </Button>
                    ) : null}
                  </div>
                </Card.Header>
                <Disclosure.Content>
                  <Card.Footer className="flex-col items-stretch gap-3 border-t">
                    <ApiKeyField
                      value={editKeyDraft}
                      disabled={!snapshot.writable || savingKey}
                      onChange={setEditKeyDraft}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onPress={() => {
                          setEditingProvider(null)
                          setEditKeyDraft('')
                        }}
                      >
                        取消
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        isDisabled={savingKey || !snapshot.writable}
                        onPress={() => void handleSaveEditKey(row)}
                      >
                        保存
                      </Button>
                    </div>
                  </Card.Footer>
                </Disclosure.Content>
              </Card>
            </Disclosure>
          )
        })}
      </div>

      <div className="flex flex-col gap-3">
        {adding && addTarget ? (
          <Card>
            <Card.Content className="flex flex-col gap-3 pt-4">
              <div className="flex flex-col gap-2">
                <Label>提供方</Label>
                <SettingsSelect
                  value={addProviderId}
                  disabled={!snapshot.writable}
                  triggerClassName="w-full"
                  onChange={setAddProviderId}
                  options={addable.map((item) => ({
                    value: item.entry.provider,
                    label: item.entry.displayName,
                  }))}
                />
              </div>
              <ApiKeyField
                value={addKeyDraft}
                disabled={!snapshot.writable || savingAdd}
                onChange={setAddKeyDraft}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onPress={closeAdding}>
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isDisabled={savingAdd || !snapshot.writable || !addKeyDraft.trim()}
                  onPress={() => void handleAddCatalogProvider()}
                >
                  保存
                </Button>
              </div>
            </Card.Content>
          </Card>
        ) : null}

        {declaring ? (
          <Card>
            <Card.Header>
              <Card.Title>添加自定义提供方</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <TextField
                value={customRoute}
                isDisabled={!snapshot.writable || savingCustom}
                isInvalid={customRouteInvalid || customRouteTaken}
                onChange={setCustomRoute}
                className="w-full"
              >
                <Label>Route ID</Label>
                <Input type="text" placeholder="acme-gateway" />
                {customRouteInvalid ? (
                  <p className="text-danger text-xs">
                    格式应为小写字母开头，仅含小写字母、数字与连字符
                  </p>
                ) : customRouteTaken ? (
                  <p className="text-danger text-xs">该 Route ID 已被占用</p>
                ) : (
                  <p className="text-muted text-xs">
                    例如 acme-gateway，将作为 llm-pi-ai.providers 下的键名
                  </p>
                )}
              </TextField>
              <TextField
                value={customDisplayName}
                isDisabled={!snapshot.writable || savingCustom}
                onChange={setCustomDisplayName}
                className="w-full"
              >
                <Label>显示名称</Label>
                <Input type="text" placeholder={customRoute || '显示名称'} />
              </TextField>
              <TextField
                value={customBaseUrl}
                isDisabled={!snapshot.writable || savingCustom}
                onChange={setCustomBaseUrl}
                className="w-full"
              >
                <Label>Base URL</Label>
                <Input type="url" placeholder="https://api.example.com/v1" />
              </TextField>
              <div className="flex flex-col gap-2">
                <Label>Protocol</Label>
                <SettingsSelect
                  value={customProtocol}
                  disabled={!snapshot.writable || savingCustom}
                  triggerClassName="w-full"
                  onChange={setCustomProtocol}
                  options={CUSTOM_PROVIDER_PROTOCOLS.map((opt) => ({
                    value: opt.value,
                    label: opt.label,
                  }))}
                />
              </div>
              <TextField
                value={customModels}
                isDisabled={!snapshot.writable || savingCustom}
                onChange={setCustomModels}
                className="w-full"
              >
                <Label>模型 ID</Label>
                <TextArea placeholder="每行一个 model id，或用逗号分隔" />
              </TextField>
              <ApiKeyField
                value={customKeyDraft}
                placeholder="可选"
                disabled={!snapshot.writable || savingCustom}
                onChange={setCustomKeyDraft}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onPress={closeDeclaring}>
                  取消
                </Button>
                <Button
                  type="button"
                  size="sm"
                  isDisabled={savingCustom || !snapshot.writable || !customReady}
                  onPress={() => void handleAddCustomProvider()}
                >
                  保存
                </Button>
              </div>
            </Card.Content>
          </Card>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className={cn('h-11 border-dashed', adding && 'opacity-70')}
            isDisabled={!snapshot.writable || (addable.length === 0 && !adding)}
            onPress={toggleAdding}
          >
            <Plus data-icon="inline-start" />
            添加提供方
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn('h-11 border-dashed', declaring && 'opacity-70')}
            isDisabled={!snapshot.writable}
            onPress={toggleDeclaring}
          >
            <Plus data-icon="inline-start" />
            添加自定义提供方
          </Button>
        </div>
      </div>

      <AlertDialog>
        <AlertDialog.Backdrop
          isOpen={deleteTarget != null}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        >
          <AlertDialog.Container>
            <AlertDialog.Dialog className={SETTINGS_PORTAL_LAYER}>
              <AlertDialog.Header>
                <AlertDialog.Heading>删除提供方</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                确定删除「{deleteTarget?.entry.displayName}」的配置与 API Key 吗？
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="outline" onPress={() => setDeleteTarget(null)}>
                  取消
                </Button>
                <Button variant="danger" onPress={() => void handleDeleteProvider()}>
                  删除
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </div>
  )
}
