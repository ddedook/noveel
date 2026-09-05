import { useCallback, useMemo } from 'react'
import { toast } from '@/app/lib/toast'

export type SettingsNamespaceView = {
  ns: string
  schema?: unknown
  value?: unknown
  user?: unknown
  base?: unknown
  revision?: number
}

export type DshSettingsSnapshot = {
  writable: boolean
  hasDocument: boolean
  namespaces: SettingsNamespaceView[]
}

export function namespaceMap(namespaces: SettingsNamespaceView[]): Map<string, SettingsNamespaceView> {
  return new Map(namespaces.map((n) => [n.ns, n]))
}

export function useSettingsNamespace(
  snapshot: DshSettingsSnapshot | null,
  ns: string,
  onReload: () => void,
) {
  const namespace = useMemo(
    () => snapshot?.namespaces.find((item) => item.ns === ns) ?? null,
    [snapshot, ns],
  )

  const mutate = useCallback(
    async (path: string[], value: unknown) => {
      if (!snapshot?.writable || !namespace) return
      try {
        await window.ipcApi.dsh.settingsMutate({
          ns,
          ops: [{ op: 'set', path, value }],
          expectedRevision: namespace.revision,
        })
        onReload()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '保存失败，请重试')
        onReload()
      }
    },
    [snapshot?.writable, namespace, ns, onReload],
  )

  const unset = useCallback(
    async (path: string[]) => {
      if (!snapshot?.writable || !namespace) return
      try {
        await window.ipcApi.dsh.settingsMutate({
          ns,
          ops: [{ op: 'unset', path }],
          expectedRevision: namespace.revision,
        })
        onReload()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '保存失败，请重试')
        onReload()
      }
    },
    [snapshot?.writable, namespace, ns, onReload],
  )

  return {
    namespace,
    writable: snapshot?.writable ?? false,
    mutate,
    unset,
  }
}
