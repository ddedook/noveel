import { readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

function isProcessAlive(pid: number): boolean {
  if (pid <= 0 || pid === process.pid) return true
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return code === 'EPERM'
  }
}

async function clearStaleLockIfNeeded(lockPath: string): Promise<boolean> {
  try {
    const content = await readFile(lockPath, 'utf8')
    const pid = Number.parseInt(content.trim(), 10)
    if (!Number.isFinite(pid) || pid <= 0) {
      await rm(lockPath, { force: true })
      return true
    }
    if (!isProcessAlive(pid)) {
      await rm(lockPath, { force: true })
      return true
    }
    return false
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return false
    return false
  }
}

/** Remove orphaned DSH writer locks left by crashed or force-killed processes. */
export async function clearStaleDshFileLocks(dshHome: string): Promise<void> {
  const credentialsLock = join(dshHome, '.credentials.yaml.lock')
  await clearStaleLockIfNeeded(credentialsLock)

  let entries: string[]
  try {
    entries = await readdir(dshHome)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return
    throw error
  }

  await Promise.all(
    entries
      .filter((name) => name.endsWith('.lock'))
      .map((name) => clearStaleLockIfNeeded(join(dshHome, name))),
  )
}
