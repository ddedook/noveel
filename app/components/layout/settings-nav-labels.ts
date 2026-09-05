import { Bot, Settings2, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export { SETTINGS_TAB_IDS } from '@/app/lib/settings-constants'
export type { SettingsTabId } from '@/app/lib/settings-constants'

export const SETTINGS_NAV_LABELS: Record<string, string> = {
  general: '通用设置',
  models: '模型',
  cursor: 'Cursor',
}

export function formatSettingsSectionLabel(ns: string): string {
  return SETTINGS_NAV_LABELS[ns] ?? ns.replace(/-/g, ' ')
}

export const SETTINGS_NAV_ICONS: Record<string, LucideIcon> = {
  general: Settings2,
  models: Sparkles,
  cursor: Bot,
}
