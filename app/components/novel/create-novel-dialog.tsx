import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Input, Label, Modal, TextField } from '@heroui/react'
import { useAppStore } from '@/app/lib/app-store'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateNovelDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const setCurrentNovelId = useAppStore((s) => s.setCurrentNovelId)
  const [title, setTitle] = useState('')
  const [workspacePath, setWorkspacePath] = useState('')
  const [error, setError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: window.ipcApi.novel.create,
    onSuccess: (novel) => {
      void queryClient.invalidateQueries({ queryKey: ['novels'] })
      setCurrentNovelId(novel.id)
      void window.ipcApi.novelContext.set({ novelId: novel.id, page: 'overview' })
      void navigate({ to: '/novel/$id/overview', params: { id: novel.id } })
      onOpenChange(false)
      setTitle('')
      setWorkspacePath('')
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : '创建失败')
    },
  })

  async function handlePickDirectory() {
    const result = await window.ipcApi.dialog.pickDirectory()
    if (result.path) {
      setWorkspacePath(result.path)
      setError(null)
    }
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>新建小说</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex flex-col gap-5">
                <TextField
                  name="title"
                  value={title}
                  onChange={setTitle}
                  className="w-full"
                >
                  <Label>名称</Label>
                  <Input placeholder="小说名称" />
                </TextField>
                <div className="flex flex-col gap-3">
                  <Label>工作目录</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={workspacePath}
                      placeholder="选择空文件夹"
                      className="min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onPress={() => void handlePickDirectory()}
                    >
                      选择目录
                    </Button>
                  </div>
                  <p className="text-muted text-xs">
                    将在该目录内创建 noveel.json、pglite 数据库与 files 文件夹
                  </p>
                </div>
                {error ? <p className="text-danger text-sm">{error}</p> : null}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline" onPress={() => onOpenChange(false)}>
                取消
              </Button>
              <Button
                isDisabled={!title.trim() || !workspacePath || createMutation.isPending}
                onPress={() =>
                  createMutation.mutate({ title: title.trim(), workspacePath })
                }
              >
                创建
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
