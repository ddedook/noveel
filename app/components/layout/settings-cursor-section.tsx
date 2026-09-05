import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button, Input, Label, Separator } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { cn } from '@/app/lib/utils'

type AccountStatus = {
  authenticated?: boolean
  provider?: string
  type?: string
  expiresAt?: number
}

type LoginFlow = {
  id?: string
  phase?: string
  authUrl?: string
  authenticated?: boolean
  error?: string
  detail?: string
  expiresAt?: number
}

type UsageModel = { id?: string; name?: string; spentDollars?: number }

type UsageSnapshot = {
  fetchedAt?: number
  includedRequests?: {
    used?: number
    limit?: number | null
    remaining?: number | null
    unlimited?: boolean
  }
  teamOnDemand?: { usedDollars?: number; limitDollars?: number | null }
  models?: UsageModel[]
}

type CursorModel = { id: string; name?: string; contextWindow?: number }

type RuntimeSettings = {
  maxToolRounds: number
  retryCount: number
  retryIntervalMs: number
  retryHttpStatusCodes: number[]
  revision: number
}

async function cursorCall<T = unknown>(
  endpoint: Parameters<typeof window.ipcApi.dsh.cursorSubscriptionCall>[0]['endpoint'],
  payload?: Record<string, unknown>,
): Promise<T> {
  return (await window.ipcApi.dsh.cursorSubscriptionCall({ endpoint, payload })) as T
}

function formatMoney(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPercent(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
}

export function SettingsCursorSection() {
  const queryClient = useQueryClient()
  const [account, setAccount] = useState<AccountStatus | undefined>()
  const [flow, setFlow] = useState<LoginFlow | undefined>()
  const [usage, setUsage] = useState<UsageSnapshot | undefined>()
  const [models, setModels] = useState<CursorModel[]>([])
  const [runtime, setRuntime] = useState<{
    maxToolRounds: string
    retryCount: string
    retryIntervalMs: string
    retryHttpStatusCodes: string
  }>()
  const [runtimeBaseline, setRuntimeBaseline] = useState<RuntimeSettings>()
  const [accountBusy, setAccountBusy] = useState(false)
  const [usageBusy, setUsageBusy] = useState(false)
  const [modelsBusy, setModelsBusy] = useState(false)
  const [settingsBusy, setSettingsBusy] = useState(false)
  const [accountError, setAccountError] = useState<string>()
  const [usageError, setUsageError] = useState<string>()
  const [modelsError, setModelsError] = useState<string>()
  const [settingsError, setSettingsError] = useState<string>()
  const [settingsSaved, setSettingsSaved] = useState(false)
  const usageReq = useRef(0)
  const modelsReq = useRef(0)

  const signedIn = account?.authenticated === true
  const accountReady = account !== undefined
  const expiresAt =
    typeof account?.expiresAt === 'number' && Number.isFinite(account.expiresAt)
      ? new Date(account.expiresAt)
      : undefined

  useEffect(() => {
    void cursorCall<AccountStatus>('status')
      .then(setAccount)
      .catch((err) => setAccountError(err instanceof Error ? err.message : '加载失败'))
  }, [])

  useEffect(() => {
    if (!flow?.id || ['authenticated', 'failed', 'cancelled'].includes(flow.phase ?? '')) {
      return undefined
    }
    const timer = window.setInterval(() => {
      void cursorCall<LoginFlow>('login/status', { id: flow.id })
        .then((next) => {
          setFlow(next)
          if (next.phase === 'authenticated') {
            void cursorCall<AccountStatus>('status')
              .then((status) => {
                setAccount(status)
                void queryClient.invalidateQueries({ queryKey: ['dsh-model-catalog'] })
              })
              .catch((err) => setAccountError(err instanceof Error ? err.message : '加载失败'))
          }
        })
        .catch((err) => setAccountError(err instanceof Error ? err.message : '登录状态刷新失败'))
    }, 1200)
    return () => window.clearInterval(timer)
  }, [flow?.id, flow?.phase, queryClient])

  useEffect(() => {
    if (!signedIn) {
      usageReq.current += 1
      setUsage(undefined)
      setUsageError(undefined)
      setUsageBusy(false)
      return
    }
    const id = ++usageReq.current
    setUsageBusy(true)
    setUsageError(undefined)
    void cursorCall<UsageSnapshot>('usage', { force: false })
      .then((next) => {
        if (usageReq.current === id) setUsage(next)
      })
      .catch((err) => {
        if (usageReq.current === id) {
          setUsageError(err instanceof Error ? err.message : '读取用量失败')
        }
      })
      .finally(() => {
        if (usageReq.current === id) setUsageBusy(false)
      })
  }, [signedIn, account?.expiresAt])

  useEffect(() => {
    if (!signedIn) {
      modelsReq.current += 1
      setModels([])
      setModelsError(undefined)
      setModelsBusy(false)
      return
    }
    const id = ++modelsReq.current
    setModelsBusy(true)
    setModelsError(undefined)
    void cursorCall<{ models?: CursorModel[] }>('models', { force: false })
      .then((next) => {
        if (modelsReq.current === id) setModels(Array.isArray(next.models) ? next.models : [])
      })
      .catch((err) => {
        if (modelsReq.current === id) {
          setModelsError(err instanceof Error ? err.message : '读取模型失败')
        }
      })
      .finally(() => {
        if (modelsReq.current === id) setModelsBusy(false)
      })
  }, [signedIn, account?.expiresAt])

  useEffect(() => {
    setSettingsBusy(true)
    setSettingsError(undefined)
    void cursorCall<RuntimeSettings>('settings')
      .then((value) => {
        setRuntimeBaseline(value)
        setRuntime({
          maxToolRounds: String(value.maxToolRounds),
          retryCount: String(value.retryCount),
          retryIntervalMs: String(value.retryIntervalMs),
          retryHttpStatusCodes: value.retryHttpStatusCodes.join(', '),
        })
      })
      .catch(() => setSettingsError('加载运行设置失败'))
      .finally(() => setSettingsBusy(false))
  }, [])

  const beginLogin = () => {
    setAccountBusy(true)
    setAccountError(undefined)
    void cursorCall<LoginFlow>('login/start', {})
      .then(setFlow)
      .catch((err) => setAccountError(err instanceof Error ? err.message : '启动登录失败'))
      .finally(() => setAccountBusy(false))
  }

  const cancelLogin = () => {
    if (!flow?.id) return
    setAccountBusy(true)
    void cursorCall<LoginFlow>('login/cancel', { id: flow.id })
      .then(setFlow)
      .finally(() => setAccountBusy(false))
  }

  const logout = () => {
    setAccountBusy(true)
    setAccountError(undefined)
    void cursorCall<AccountStatus>('logout')
      .then((next) => {
        setAccount(next)
        setFlow(undefined)
        setUsage(undefined)
        setModels([])
        void queryClient.invalidateQueries({ queryKey: ['dsh-model-catalog'] })
      })
      .catch((err) => setAccountError(err instanceof Error ? err.message : '登出失败'))
      .finally(() => setAccountBusy(false))
  }

  const refreshUsage = () => {
    if (!signedIn) return
    const id = ++usageReq.current
    setUsageBusy(true)
    setUsageError(undefined)
    void cursorCall<UsageSnapshot>('usage', { force: true })
      .then((next) => {
        if (usageReq.current === id) setUsage(next)
      })
      .catch((err) => {
        if (usageReq.current === id) {
          setUsageError(err instanceof Error ? err.message : '读取用量失败')
        }
      })
      .finally(() => {
        if (usageReq.current === id) setUsageBusy(false)
      })
  }

  const refreshModels = () => {
    if (!signedIn) return
    const id = ++modelsReq.current
    setModelsBusy(true)
    setModelsError(undefined)
    void cursorCall<{ models?: CursorModel[] }>('models', { force: true })
      .then((next) => {
        if (modelsReq.current === id) setModels(Array.isArray(next.models) ? next.models : [])
        void queryClient.invalidateQueries({ queryKey: ['dsh-model-catalog'] })
      })
      .catch((err) => {
        if (modelsReq.current === id) {
          setModelsError(err instanceof Error ? err.message : '读取模型失败')
        }
      })
      .finally(() => {
        if (modelsReq.current === id) setModelsBusy(false)
      })
  }

  const saveRuntime = () => {
    if (!runtime || !runtimeBaseline) return
    try {
      const parseIntField = (value: string, min: number, max: number) => {
        if (!/^\d+$/.test(value.trim())) throw new Error('invalid')
        const n = Number(value)
        if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error('range')
        return n
      }
      const statusText = runtime.retryHttpStatusCodes.trim()
      if (statusText !== '' && !/^\d{3}(?:\s*,\s*\d{3})*$/.test(statusText)) {
        throw new Error('statuses')
      }
      const statuses =
        statusText === ''
          ? []
          : statusText.split(',').map((part) => parseIntField(part, 400, 599))
      if (new Set(statuses).size !== statuses.length) throw new Error('dup')

      const patch = {
        maxToolRounds: parseIntField(runtime.maxToolRounds, 1, 1000),
        retryCount: parseIntField(runtime.retryCount, 0, 10),
        retryIntervalMs: parseIntField(runtime.retryIntervalMs, 0, 300_000),
        retryHttpStatusCodes: statuses,
        revision: runtimeBaseline.revision,
      }

      setSettingsBusy(true)
      setSettingsError(undefined)
      setSettingsSaved(false)
      void cursorCall<RuntimeSettings>('settings/update', patch)
        .then((value) => {
          setRuntimeBaseline(value)
          setRuntime({
            maxToolRounds: String(value.maxToolRounds),
            retryCount: String(value.retryCount),
            retryIntervalMs: String(value.retryIntervalMs),
            retryHttpStatusCodes: value.retryHttpStatusCodes.join(', '),
          })
          setSettingsSaved(true)
          toast.success('已保存')
        })
        .catch((err) => {
          setSettingsError(err instanceof Error ? err.message : '保存失败')
        })
        .finally(() => setSettingsBusy(false))
    } catch {
      setSettingsError('请检查工具轮次、重试次数、间隔与 HTTP 状态码')
    }
  }

  const waiting =
    flow &&
    flow.phase &&
    !['authenticated', 'failed', 'cancelled'].includes(flow.phase) &&
    Boolean(flow.id)

  const included = usage?.includedRequests
  const includedLimit =
    included?.unlimited || included?.limit == null
      ? null
      : Number(included.limit)
  const includedUsed = Number(included?.used ?? 0)
  const includedPct =
    includedLimit && includedLimit > 0 ? Math.min(100, (includedUsed / includedLimit) * 100) : undefined

  return (
    <div className="flex flex-col gap-6 py-2">
      <section className="rounded-xl ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2.5 rounded-full',
                !accountReady && 'bg-muted',
                accountReady && signedIn && 'bg-success',
                accountReady && !signedIn && 'bg-danger',
              )}
              aria-hidden
            />
            <p className="text-sm font-medium">
              {!accountReady ? '加载账户…' : signedIn ? '已登录' : '未登录'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button type="button" variant="outline" size="sm" isDisabled={accountBusy} onPress={logout}>
                退出登录
              </Button>
            ) : waiting ? (
              <Button type="button" variant="outline" size="sm" isDisabled={accountBusy} onPress={cancelLogin}>
                取消
              </Button>
            ) : (
              <Button type="button" size="sm" isDisabled={accountBusy} onPress={beginLogin}>
                浏览器登录
              </Button>
            )}
          </div>
        </div>
        <Separator />
        <div className="flex flex-col gap-2 px-4 py-3 text-sm">
          {signedIn && expiresAt ? (
            <p className="text-muted">令牌有效期至 {expiresAt.toLocaleString()}</p>
          ) : null}
          {waiting ? (
            <p>请在浏览器中完成 Cursor 授权。完成后本页会自动更新为已登录。</p>
          ) : null}
          {flow?.phase === 'failed' ? (
            <p className="text-danger" role="alert">
              {flow.error ?? accountError ?? '登录失败'}
              {flow.detail ? `（${flow.detail}）` : null}
            </p>
          ) : null}
          {accountError && flow?.phase !== 'failed' ? (
            <p className="text-danger" role="alert">
              {accountError}
            </p>
          ) : null}
          <p className="text-muted text-xs leading-relaxed">
            使用 Cursor 订阅登录后，可在对话模型选择器中选用 cursor-subscription
            提供的模型。凭据保存在本机 DSH 凭据存储中，不会回传到界面。
          </p>
        </div>
      </section>

      <section className="rounded-xl ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h3 className="text-sm font-medium">用量</h3>
            {typeof usage?.fetchedAt === 'number' ? (
              <p className="text-muted text-xs">
                更新于 {new Date(usage.fetchedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isDisabled={!signedIn || usageBusy}
            onPress={refreshUsage}
          >
            {usageBusy ? '刷新中…' : '刷新'}
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 text-sm">
          {!signedIn ? (
            <p className="text-muted">登录后可查看订阅用量</p>
          ) : usageError ? (
            <p className="text-danger" role="alert">
              {usageError}
            </p>
          ) : !usage && usageBusy ? (
            <p className="text-muted">加载中…</p>
          ) : usage ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-muted">计划内请求</span>
                <strong>
                  {included?.unlimited
                    ? '无限制'
                    : includedLimit == null
                      ? '—'
                      : `${includedUsed} / ${includedLimit}${includedPct != null ? `（${formatPercent(includedPct)}）` : ''}`}
                </strong>
              </div>
              {usage.teamOnDemand ? (
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-muted">按需消费</span>
                  <strong>
                    ${formatMoney(usage.teamOnDemand.usedDollars)}
                    {usage.teamOnDemand.limitDollars != null
                      ? ` / $${formatMoney(usage.teamOnDemand.limitDollars)}`
                      : ''}
                  </strong>
                </div>
              ) : null}
              {Array.isArray(usage.models) && usage.models.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <p className="text-muted text-xs">模型消费</p>
                  <ul className="flex flex-col gap-1">
                    {usage.models.slice(0, 12).map((model) => (
                      <li key={model.id ?? model.name} className="flex justify-between gap-2">
                        <span className="truncate">{model.name ?? model.id ?? '—'}</span>
                        <span>${formatMoney(model.spentDollars)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-muted">暂无用量数据</p>
          )}
        </div>
      </section>

      <section className="rounded-xl ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <h3 className="text-sm font-medium">可用模型</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isDisabled={!signedIn || modelsBusy}
            onPress={refreshModels}
          >
            {modelsBusy ? '刷新中…' : '刷新'}
          </Button>
        </div>
        <Separator />
        <div className="px-4 py-3 text-sm">
          {!signedIn ? (
            <p className="text-muted">登录后可查看账户可用模型</p>
          ) : modelsError ? (
            <p className="text-danger" role="alert">
              {modelsError}
            </p>
          ) : models.length === 0 ? (
            <p className="text-muted">{modelsBusy ? '加载中…' : '暂无模型（将使用内置回退列表）'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {models.map((model) => (
                <span
                  key={model.id}
                  className="bg-default text-default-foreground rounded-md px-2 py-1 text-xs"
                  title={model.name ?? model.id}
                >
                  {model.id}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl ring-1 ring-foreground/10">
        <div className="px-4 py-3">
          <h3 className="text-sm font-medium">运行设置</h3>
          <p className="text-muted text-xs leading-relaxed">
            调整单次 Cursor 任务的工具轮次与 HTTP 重试。流式请求无法证明失败是否已被远端处理，启用重试可能重复用量。
          </p>
        </div>
        <Separator />
        <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cursor-max-tool-rounds">最大工具轮次</Label>
            <Input
              id="cursor-max-tool-rounds"
              value={runtime?.maxToolRounds ?? ''}
              disabled={settingsBusy || !runtime}
              onChange={(e) => {
                setRuntime((cur) => (cur ? { ...cur, maxToolRounds: e.target.value } : cur))
                setSettingsSaved(false)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cursor-retry-count">重试次数</Label>
            <Input
              id="cursor-retry-count"
              value={runtime?.retryCount ?? ''}
              disabled={settingsBusy || !runtime}
              onChange={(e) => {
                setRuntime((cur) => (cur ? { ...cur, retryCount: e.target.value } : cur))
                setSettingsSaved(false)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cursor-retry-interval">重试间隔（毫秒）</Label>
            <Input
              id="cursor-retry-interval"
              value={runtime?.retryIntervalMs ?? ''}
              disabled={settingsBusy || !runtime}
              onChange={(e) => {
                setRuntime((cur) => (cur ? { ...cur, retryIntervalMs: e.target.value } : cur))
                setSettingsSaved(false)
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="cursor-retry-statuses">重试 HTTP 状态码</Label>
            <Input
              id="cursor-retry-statuses"
              value={runtime?.retryHttpStatusCodes ?? ''}
              placeholder="408, 425, 429, 500, 502, 503, 504"
              disabled={settingsBusy || !runtime}
              onChange={(e) => {
                setRuntime((cur) => (cur ? { ...cur, retryHttpStatusCodes: e.target.value } : cur))
                setSettingsSaved(false)
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
          <Button type="button" size="sm" isDisabled={settingsBusy || !runtime} onPress={saveRuntime}>
            {settingsBusy ? '保存中…' : '保存'}
          </Button>
          {settingsSaved ? <span className="text-success text-xs">已保存</span> : null}
          {settingsError ? (
            <span className="text-danger text-xs" role="alert">
              {settingsError}
            </span>
          ) : null}
        </div>
      </section>
    </div>
  )
}
