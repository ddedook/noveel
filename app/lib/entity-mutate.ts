import type { MutateReport } from '@/lib/ipc/schemas/skill-schema'

export type { MutateReport }

export type MutateResultItem = {
  index: number
  ok: boolean
  domain?: string
  action?: string
  id?: string
  message?: string
}

export function extractCreatedId(report: MutateReport, index = 0): string | null {
  const results = report.results as MutateResultItem[]
  const item = results[index]
  if (item?.ok && item.id) return item.id
  for (const r of results) {
    if (r.ok && r.action === 'create' && r.id) return r.id
  }
  return null
}

export function firstMutateError(report: MutateReport): string | null {
  const results = report.results as MutateResultItem[]
  for (const r of results) {
    if (!r.ok && r.message) return r.message
  }
  return report.ok ? null : '操作失败'
}
