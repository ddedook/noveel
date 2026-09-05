import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

const BUSY_ENTER_NS = 'ui-conversation'

export function useDshBusyEnter(): 'queue' | 'steer' {
  const settingsQuery = useQuery({
    queryKey: ['dsh-settings'],
    queryFn: () => window.ipcApi.dsh.settingsDescribe(),
    staleTime: 30_000,
  })

  return useMemo(() => {
    const namespaces = settingsQuery.data?.namespaces ?? []
    const ns = namespaces.find((n) => n.id === BUSY_ENTER_NS)
    const value = ns?.value as { busyEnter?: string } | undefined
    return value?.busyEnter === 'steer' ? 'steer' : 'queue'
  }, [settingsQuery.data])
}
