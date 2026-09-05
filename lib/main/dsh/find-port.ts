import { createServer } from 'node:net'

export async function isPortAvailable(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close(() => resolve(true))
    })
    server.listen(port, host)
  })
}

export async function findAvailablePort(start = 3080, attempts = 20): Promise<number> {
  for (let i = 0; i < attempts; i++) {
    const port = start + i
    if (await isPortAvailable(port)) return port
  }
  throw new Error(`No available port found in range ${String(start)}–${String(start + attempts - 1)}`)
}
