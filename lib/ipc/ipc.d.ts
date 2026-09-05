import type { IpcApi } from '@/lib/preload/preload'

declare global {
  interface Window {
    ipcApi: IpcApi
  }
}

export {}
