import { getHostContext } from '@/lib/main/dsh/host-boot'

type CredentialInfo = {
  configured: boolean
  source?: string
  writable: boolean
}

type CredentialsController = {
  describe: (refs: string[]) => Promise<Record<string, CredentialInfo>>
  set: (ref: string, value: string) => Promise<void>
  unset: (ref: string) => Promise<void>
}

function getCredentialsController(): CredentialsController {
  const ctx = getHostContext()
  if (ctx === null) throw new Error('DSH host is not ready')
  const controller = ctx.get('credentialsController') as CredentialsController | undefined
  if (!controller?.describe) throw new Error('DSH credentials controller unavailable')
  return controller
}

/** Map CredentialInfo to the string shape expected by settings UI (non-empty = configured). */
function projectCredentialInfo(info: Record<string, CredentialInfo>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [ref, cred] of Object.entries(info)) {
    result[ref] = cred.configured ? '••••••••' : ''
  }
  return result
}

export async function describeDshCredentials(
  refs: string[],
): Promise<Record<string, string>> {
  if (refs.length === 0) return {}
  const info = await getCredentialsController().describe(refs)
  return projectCredentialInfo(info)
}

export async function setDshCredential(ref: string, value: string): Promise<{ ok: true }> {
  await getCredentialsController().set(ref, value)
  return { ok: true }
}

export async function unsetDshCredential(ref: string): Promise<{ ok: true }> {
  await getCredentialsController().unset(ref)
  return { ok: true }
}
