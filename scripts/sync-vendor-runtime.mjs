import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dirname, '..')
const upstreamPath = join(root, 'upstream.json')
const packagePath = join(root, 'package.json')
const dshDesktopVendor = join(root, '../dsh-desktop/vendor')
const vendorModules = join(root, 'vendor/node_modules')
const mode = process.argv[2]

if (mode !== '--write' && mode !== '--check') {
  throw new Error('usage: node scripts/sync-vendor-runtime.mjs <--write|--check>')
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const fail = (message) => {
  throw new Error(`sync-vendor-runtime: ${message}`)
}

const upstream = readJson(upstreamPath)
const version = upstream.sourceVersion
const vendorRelative = `vendor/dsh-runtime/${version}`
const vendorDirectory = join(root, ...vendorRelative.split('/'))
const manifestPath = join(vendorDirectory, 'manifest.json')
const sourceVendorDirectory = join(dshDesktopVendor, 'dsh-runtime', version)

function packageName(filename) {
  const suffix = `-${version}.tgz`
  const unscoped = filename.slice('deepseek-ai-'.length, -suffix.length)
  return `@deepseek-ai/${unscoped}`
}

function writeVendor() {
  const sourceManifest = join(sourceVendorDirectory, 'manifest.json')
  if (!existsSync(sourceManifest)) {
    fail(`missing source manifest at ${relative(root, sourceManifest)}`)
  }
  mkdirSync(vendorDirectory, { recursive: true })
  cpSync(sourceVendorDirectory, vendorDirectory, { recursive: true, force: true })
  process.stdout.write(`sync-vendor-runtime: copied vendor from dsh-desktop\n`)
}

function installVendorNodeModules() {
  const manifest = readJson(manifestPath)
  rmSync(vendorModules, { recursive: true, force: true })
  mkdirSync(vendorModules, { recursive: true })

  for (const entry of manifest.packages) {
    const tarball = join(vendorDirectory, entry.filename)
    if (!existsSync(tarball)) fail(`missing ${entry.filename}`)
    const tmp = mkdtempSync(join(tmpdir(), 'noveel-vendor-'))
    try {
      execSync(`tar -xzf ${JSON.stringify(tarball)} -C ${JSON.stringify(tmp)}`, { stdio: 'pipe' })
      const pkgDir = join(tmp, 'package')
      const pkgJson = readJson(join(pkgDir, 'package.json'))
      const [scope, name] = pkgJson.name.split('/')
      const target = scope.startsWith('@')
        ? join(vendorModules, scope, name)
        : join(vendorModules, pkgJson.name)
      mkdirSync(dirname(target), { recursive: true })
      cpSync(pkgDir, target, { recursive: true })
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  }

  process.stdout.write(
    `install-vendor-modules: extracted ${String(manifest.packages.length)} packages to vendor/node_modules\n`,
  )
}

function mergeStagedModules(stagedModules) {
  for (const entry of readdirSync(stagedModules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin') continue
    if (entry.name.startsWith('@')) {
      const scopeDir = join(stagedModules, entry.name)
      mkdirSync(join(vendorModules, entry.name), { recursive: true })
      for (const pkg of readdirSync(scopeDir, { withFileTypes: true })) {
        if (!pkg.isDirectory()) continue
        cpSync(join(scopeDir, pkg.name), join(vendorModules, entry.name, pkg.name), {
          recursive: true,
        })
      }
      continue
    }
    cpSync(join(stagedModules, entry.name), join(vendorModules, entry.name), { recursive: true })
  }
}

function listInstalledPackages() {
  const installed = new Set()
  for (const entry of readdirSync(vendorModules, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin') continue
    if (entry.name.startsWith('@')) {
      const scopeDir = join(vendorModules, entry.name)
      for (const pkg of readdirSync(scopeDir, { withFileTypes: true })) {
        if (pkg.isDirectory()) installed.add(`${entry.name}/${pkg.name}`)
      }
      continue
    }
    if (existsSync(join(vendorModules, entry.name, 'package.json'))) {
      installed.add(entry.name)
    }
  }
  return installed
}

function collectMissingDeps(installed) {
  const missing = new Map()
  const skipDep = (name) =>
    name.startsWith('@types/') ||
    name.startsWith('@vitest/') ||
    name === 'vitest' ||
    name === 'msw' ||
    name === 'jsdom' ||
    name === 'happy-dom' ||
    name === 'bufferutil' ||
    name === 'utf-8-validate'

  const addDep = (name, version) => {
    if (skipDep(name)) return
    if (installed.has(name)) return
    if (!missing.has(name)) missing.set(name, version)
  }

  for (const name of installed) {
    const pkgPath = join(vendorModules, ...name.split('/'), 'package.json')
    if (!existsSync(pkgPath)) continue
    const pkgJson = readJson(pkgPath)
    for (const [depName, depVersion] of Object.entries(pkgJson.dependencies ?? {})) {
      addDep(depName, depVersion)
    }
    for (const [depName, depVersion] of Object.entries(pkgJson.peerDependencies ?? {})) {
      const optional = pkgJson.peerDependenciesMeta?.[depName]?.optional === true
      if (!optional) addDep(depName, depVersion)
    }
  }
  return missing
}

function installMissingTransitiveDeps() {
  for (let round = 0; round < 6; round++) {
    const installed = listInstalledPackages()
    const missing = collectMissingDeps(installed)
    if (missing.size === 0) break

    const staging = mkdtempSync(join(tmpdir(), 'noveel-vendor-ext-'))
    try {
      writeJson(join(staging, 'package.json'), {
        name: 'noveel-vendor-transitive',
        private: true,
        dependencies: Object.fromEntries(missing),
      })
      execSync('npm install --omit=dev --no-package-lock --legacy-peer-deps', {
        cwd: staging,
        stdio: 'pipe',
        env: { ...process.env, npm_config_legacy_peer_deps: 'true' },
      })
      mergeStagedModules(join(staging, 'node_modules'))
    } finally {
      rmSync(staging, { recursive: true, force: true })
    }

    process.stdout.write(
      `install-vendor-modules: round ${String(round + 1)} merged ${String(missing.size)} transitive dependencies\n`,
    )
  }
}

function checkVendor() {
  if (!existsSync(manifestPath)) fail(`missing ${relative(root, manifestPath)}`)
  const manifest = readJson(manifestPath)
  if (manifest.version !== version) fail('manifest version mismatch')

  for (const entry of manifest.packages) {
    const path = join(vendorDirectory, entry.filename)
    if (!existsSync(path) || statSync(path).size !== entry.size || sha256(path) !== entry.sha256) {
      fail(`integrity mismatch for ${entry.filename}`)
    }
    const installed = join(vendorModules, ...entry.name.split('/'), 'package.json')
    if (!existsSync(installed)) fail(`missing installed module ${entry.name}`)
  }

  for (const entry of readdirSync(vendorDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name === 'manifest.json' || !entry.name.endsWith('.tgz')) continue
    packageName(entry.name)
  }

  process.stdout.write(`sync-vendor-runtime: ${String(manifest.packages.length)} packages verified\n`)
}

if (mode === '--write') {
  if (existsSync(sourceVendorDirectory)) {
    writeVendor()
  } else if (existsSync(manifestPath)) {
    process.stdout.write(
      'sync-vendor-runtime: dsh-desktop vendor missing; using existing local vendor/dsh-runtime\n',
    )
  } else {
    fail(
      `missing source vendor at ${relative(root, sourceVendorDirectory)} and local ${relative(root, vendorDirectory)}`,
    )
  }
  installVendorNodeModules()
  installMissingTransitiveDeps()
} else {
  checkVendor()
}
