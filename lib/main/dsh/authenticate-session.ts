import type { WebContents } from 'electron'
import { getDshAuthUrl, getDshBootInfo } from '@/lib/main/dsh/harness-manager'

export async function authenticateDshWebContents(webContents: WebContents): Promise<boolean> {
  const info = getDshBootInfo()
  const authUrl = getDshAuthUrl()
  if (!info.ready || authUrl.length === 0) return false

  const response = await webContents.session.fetch(authUrl, {
    method: 'GET',
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
  })

  if (response.status !== 200) {
    console.warn(`DSH browser auth failed: HTTP ${String(response.status)}`)
    return false
  }

  await response.body?.cancel()
  return true
}

/** @deprecated Use authenticateDshWebContents */
export async function authenticateDshRendererSession(window: {
  webContents: WebContents
}): Promise<boolean> {
  return authenticateDshWebContents(window.webContents)
}
