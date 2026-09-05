import {
  bootNoveelHost,
  getHostContext,
  recoverHostBootInfo,
  stopNoveelHost,
} from '@/lib/main/dsh/host-boot'
import { clearStaleDshFileLocks } from '@/lib/main/dsh/dsh-lock-cleanup'
import { app } from 'electron'
import { join } from 'node:path'

let bootInfo: { url: string; authUrl: string; ready: boolean } | null = null
let bootPromise: Promise<void> | null = null

async function resetDshHost(userData?: string): Promise<void> {
  await stopNoveelHost()
  if (userData) {
    await clearStaleDshFileLocks(join(userData, 'dsh'))
  }
  bootInfo = null
}

async function syncBootInfoFromHost(): Promise<boolean> {
  const recovered = await recoverHostBootInfo()
  if (recovered === null) return false
  bootInfo = recovered
  return true
}

async function runBoot(userData: string, throwOnError: boolean): Promise<void> {
  if (bootInfo?.ready && getHostContext() !== null) return

  if (getHostContext() !== null && (await syncBootInfoFromHost())) return

  try {
    const result = await bootNoveelHost(userData)
    bootInfo = { url: result.url, authUrl: result.authUrl, ready: result.ready }
  } catch (error) {
    console.warn('DSH Host boot failed:', error)
    await resetDshHost(userData)
    bootInfo = { url: '', authUrl: '', ready: false }
    if (throwOnError) throw error
  }
}

export async function startDshHost(userData: string, options?: { throwOnError?: boolean }): Promise<void> {
  if (bootInfo?.ready && getHostContext() !== null) return
  if (getHostContext() !== null && (await syncBootInfoFromHost())) return

  if (bootPromise) {
    await bootPromise
    return
  }

  bootPromise = runBoot(userData, options?.throwOnError ?? false).finally(() => {
    bootPromise = null
  })
  await bootPromise
}

export async function ensureDshHostReady(userData: string): Promise<void> {
  if (bootInfo?.ready && getHostContext() !== null) return
  if (getHostContext() !== null && (await syncBootInfoFromHost())) return

  if (bootPromise) {
    await bootPromise
    if (bootInfo?.ready && getHostContext() !== null) return
    throw new Error('DSH host is not ready. 请重启 Noveel，或关闭占用端口的其他实例后重试。')
  }

  await resetDshHost(userData)
  await startDshHost(userData, { throwOnError: true })

  if (!bootInfo?.ready || getHostContext() === null) {
    throw new Error('DSH host is not ready. 请重启 Noveel，或关闭占用端口的其他实例后重试。')
  }
}

export function getDshBootInfo(): { url: string; ready: boolean } {
  if (bootInfo === null) return { url: '', ready: false }
  return { url: bootInfo.url, ready: bootInfo.ready }
}

export function getDshAuthUrl(): string {
  return bootInfo?.authUrl ?? ''
}

export function stopDshHost(): void {
  void resetDshHost(app.getPath('userData'))
}

export function getDshHome(): string {
  return join(app.getPath('userData'), 'dsh')
}
