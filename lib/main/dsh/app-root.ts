import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

let cachedRoot: string | null = null

function isNoveelRoot(dir: string): boolean {
  return (
    existsSync(join(dir, 'package.json')) &&
    existsSync(join(dir, 'vendor/node_modules/@deepseek-ai/dsh/package.json'))
  )
}

export function noveelAppRoot(): string {
  if (cachedRoot !== null) return cachedRoot

  const cwd = process.cwd()
  if (isNoveelRoot(cwd)) {
    cachedRoot = cwd
    return cwd
  }

  let dir = dirname(fileURLToPath(import.meta.url))
  for (let depth = 0; depth < 8; depth++) {
    if (isNoveelRoot(dir)) {
      cachedRoot = dir
      return dir
    }
    dir = dirname(dir)
  }

  throw new Error('noveel app root not found (missing package.json or vendor/node_modules)')
}
