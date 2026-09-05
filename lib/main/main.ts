import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initRegistryDb } from '@/lib/main/db/registry-pglite'
import { setUserDataRoot } from '@/lib/main/db/novel-db-pool'
import { registerIpcHandlers, setUserDataPath } from '@/lib/ipc/handlers'
import { startDshHost, stopDshHost } from '@/lib/main/dsh/harness-manager'
import { unsubscribeAllChatEvents } from '@/lib/main/dsh/chat-bridge'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'Noveel',
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function bootstrap(): Promise<void> {
  const userData = app.getPath('userData')
  setUserDataPath(userData)
  setUserDataRoot(userData)
  await initRegistryDb(userData)
  registerIpcHandlers(() => mainWindow)
  await startDshHost(userData)
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.noveel.app')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  await bootstrap()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  unsubscribeAllChatEvents()
  stopDshHost()
})
