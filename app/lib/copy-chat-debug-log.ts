import { toast } from '@/app/lib/toast'

export async function copyChatDebugLog(dshSessionId: string | null | undefined): Promise<boolean> {
  if (!dshSessionId) {
    toast.error('当前无会话')
    return false
  }
  try {
    const { json } = await window.ipcApi.dsh.chatExportDebugLog({ dshSessionId })
    await navigator.clipboard.writeText(json)
    toast.success('已复制')
    return true
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '复制会话日志失败')
    return false
  }
}
