export type ProviderDirectoryEntry = {
  provider: string
  displayName: string
  settingsNs: string
  settingsPath: string[]
  active: boolean
  declared?: boolean
}

export type CredentialState = {
  configured: boolean
  masked?: string
}

export type ProviderRow = {
  entry: ProviderDirectoryEntry
  configured: boolean
  removable: boolean
  apiKeyEnv?: string
  credential?: CredentialState
}

export function deriveKeyRef(provider: string): string {
  return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`
}

export function joinProviderDirectory(
  registered: Array<{ id: string; name: string }>,
  directory: Array<{
    provider: string
    displayName: string
    settingsNs: string
    settingsPath: string[]
    declared?: boolean
  }>,
): ProviderDirectoryEntry[] {
  const active = new Set(registered.map((p) => p.id))
  const declared = new Set(directory.map((e) => e.provider))
  const rows: ProviderDirectoryEntry[] = directory.map((entry) => ({
    provider: entry.provider,
    displayName: entry.displayName,
    settingsNs: entry.settingsNs,
    settingsPath: [...entry.settingsPath],
    active: active.has(entry.provider),
    ...(entry.declared === undefined ? {} : { declared: entry.declared }),
  }))
  for (const provider of registered) {
    if (declared.has(provider.id)) continue
    rows.push({
      provider: provider.id,
      displayName: provider.name,
      settingsNs: '',
      settingsPath: [],
      active: true,
    })
  }
  return rows
}

export function getPathValue(obj: unknown, path: string[]): unknown {
  let current: unknown = obj
  for (const key of path) {
    if (current == null || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

export function hasPath(obj: unknown, path: string[]): boolean {
  return getPathValue(obj, path) !== undefined
}

export function apiKeyEnvOf(
  namespaceValue: unknown,
  settingsPath: string[],
): string | undefined {
  const profile =
    settingsPath.length === 0
      ? namespaceValue
      : getPathValue(namespaceValue, settingsPath)
  if (typeof profile !== 'object' || profile === null) return undefined
  const ref = (profile as Record<string, unknown>).apiKeyEnv
  return typeof ref === 'string' && ref.length > 0 ? ref : undefined
}

export function buildProviderRows(
  entries: ProviderDirectoryEntry[],
  namespaces: Map<string, { value?: unknown; user?: unknown; base?: unknown }>,
  credentials: Record<string, string>,
): ProviderRow[] {
  return entries.map((entry) => {
    const namespace = entry.settingsNs ? namespaces.get(entry.settingsNs) : undefined
    const configured =
      namespace !== undefined &&
      (entry.settingsPath.length === 0 || hasPath(namespace.value, entry.settingsPath))
    const removable =
      namespace !== undefined &&
      entry.settingsPath.length > 0 &&
      hasPath(namespace.user, entry.settingsPath) &&
      !hasPath(namespace.base, entry.settingsPath)
    const apiKeyEnv = namespace ? apiKeyEnvOf(namespace.value, entry.settingsPath) : undefined
    const ref = apiKeyEnv ?? deriveKeyRef(entry.provider)
    const raw = credentials[ref]
    const credential: CredentialState | undefined =
      raw !== undefined
        ? { configured: raw.length > 0, masked: raw.length > 0 ? '••••••••' : undefined }
        : undefined
    return { entry, configured, removable, apiKeyEnv, credential }
  })
}

export function providerUsable(row: ProviderRow): boolean {
  if (!row.entry.active) return false
  if (row.apiKeyEnv === undefined) return true
  return row.credential?.configured === true
}
