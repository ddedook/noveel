import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ImageIcon, Trash2 } from 'lucide-react'
import { Button, Input, Label, TextArea, TextField } from '@heroui/react'
import { toast } from '@/app/lib/toast'
import { DetailSaveFooter } from '@/app/components/novel-workspace/detail-save-footer'
import { useNovelRouteContext } from '@/app/hooks/use-novel-route-context'
import { isDisplayableCover, pickCoverImageAsDataUrl } from '@/app/lib/pick-cover-image'
import { cn } from '@/app/lib/utils'

export function NovelBasicPage() {
  const { novelId, novel, isLoading } = useNovelRouteContext('basic')
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [cover, setCover] = useState('')

  useEffect(() => {
    if (!novel) return
    setTitle(novel.title)
    setDescription(novel.description)
    setCategory(novel.category)
    setCover(novel.cover ?? '')
  }, [novel])

  const updateMutation = useMutation({
    mutationFn: window.ipcApi.novel.update,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['novel', novelId] })
      toast.success('已保存')
    },
    onError: (e: Error) => toast.error(e.message || '保存失败'),
  })

  async function handlePickCover() {
    const dataUrl = await pickCoverImageAsDataUrl()
    if (dataUrl) setCover(dataUrl)
  }

  if (isLoading || !novelId) {
    return <div className="text-sm text-muted">加载中…</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h2 className="text-xl font-semibold">基础信息</h2>
      <div className="flex flex-col gap-7 rounded-lg border p-5">
        <div className="flex flex-col gap-3">
          <Label>封面</Label>
          <div className="flex flex-wrap items-start gap-4">
            <div
              className={cn(
                'relative flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-default',
                'outline outline-1 outline-black/10 dark:outline-white/10',
              )}
            >
              {isDisplayableCover(cover) ? (
                <img src={cover} alt="封面" className="h-full w-full object-cover" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted" strokeWidth={1.5} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" onPress={() => void handlePickCover()}>
                更换封面
              </Button>
              {cover ? (
                <Button type="button" variant="ghost" size="sm" className="text-danger" onPress={() => setCover('')}>
                  <Trash2 className="mr-1 h-3.5 w-3.5" strokeWidth={1.5} />
                  清除
                </Button>
              ) : null}
              <p className="text-xs text-muted">支持 JPG/PNG/WebP/GIF，最大 2MB</p>
            </div>
          </div>
        </div>
        <TextField value={title} onChange={setTitle} className="flex flex-col gap-3">
          <Label>标题</Label>
          <Input />
        </TextField>
        <TextField value={category} onChange={setCategory} className="flex flex-col gap-3">
          <Label>题材</Label>
          <Input />
        </TextField>
        <TextField value={description} onChange={setDescription} className="flex flex-col gap-3">
          <Label>简介</Label>
          <TextArea rows={6} />
        </TextField>
        <DetailSaveFooter
          onSave={() => updateMutation.mutate({ id: novelId, title, description, category, cover })}
          saving={updateMutation.isPending}
        />
      </div>
    </div>
  )
}
