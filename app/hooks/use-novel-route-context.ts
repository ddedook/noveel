import { useParams } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/app/lib/app-store'

export function useNovelRouteContext(page: Parameters<typeof window.ipcApi.novelContext.set>[0]['page']) {
  const { id } = useParams({ strict: false }) as { id?: string }
  const setCurrentNovelId = useAppStore((s) => s.setCurrentNovelId)
  const setCurrentPage = useAppStore((s) => s.setCurrentPage)

  useEffect(() => {
    if (id) {
      setCurrentNovelId(id)
      setCurrentPage(page)
      void window.ipcApi.novelContext.set({ novelId: id, page })
    }
  }, [id, page, setCurrentNovelId, setCurrentPage])

  const novelQuery = useQuery({
    queryKey: ['novel', id],
    queryFn: () => window.ipcApi.novel.get({ id: id! }),
    enabled: Boolean(id),
  })

  return { novelId: id, novel: novelQuery.data, isLoading: novelQuery.isLoading }
}
