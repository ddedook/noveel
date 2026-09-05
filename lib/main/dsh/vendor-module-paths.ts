import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import Module from 'node:module'
import { noveelAppRoot } from '@/lib/main/dsh/app-root'

type NodeModuleInternals = typeof Module & {
  _nodeModulePaths: (from: string) => string[]
  globalPaths: string[]
}

const nodeModule = Module as NodeModuleInternals

export function vendorNodeModulesRoot(): string {
  return join(noveelAppRoot(), 'vendor/node_modules')
}

export function registerVendorModulePaths(): void {
  const root = vendorNodeModulesRoot()
  if (!existsSync(root)) return
  const paths = nodeModule._nodeModulePaths(root)
  for (const p of paths) {
    if (!nodeModule.globalPaths.includes(p)) nodeModule.globalPaths.push(p)
  }
}

export function vendorRequire() {
  const anchor = join(vendorNodeModulesRoot(), '@deepseek-ai/dsh/package.json')
  if (!existsSync(anchor)) {
    throw new Error(`vendor anchor missing at ${anchor}`)
  }
  return createRequire(pathToFileURL(anchor).href)
}

export async function importVendorModule<T extends Record<string, unknown>>(
  specifier: string,
): Promise<T> {
  registerVendorModulePaths()
  const resolved = vendorRequire().resolve(specifier)
  return import(pathToFileURL(resolved).href) as Promise<T>
}

export function vendorModuleUrl(specifier: string): string {
  const root = vendorNodeModulesRoot()
  const pkgPath = join(root, ...specifier.split('/'), 'package.json')
  if (!existsSync(pkgPath)) throw new Error(`vendor module missing: ${specifier}`)
  return pathToFileURL(pkgPath).href.replace('/package.json', '/')
}
