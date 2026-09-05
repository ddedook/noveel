export const SETTINGS_TAB_IDS = ['general', 'models', 'cursor'] as const
export type SettingsTabId = (typeof SETTINGS_TAB_IDS)[number]

export const PERMISSION_PRESET_LABELS: Record<string, string> = {
  'read-only': 'Read Only',
  'workspace-write': 'Workspace Write',
  'danger-full-access': 'Danger Full Access',
}

export const PERMISSION_PRESET_DESCRIPTIONS: Record<string, string> = {
  'read-only': '只读访问，不可修改文件',
  'workspace-write': '可读写工作区文件',
  'danger-full-access': '完全访问，包含高风险操作',
}

export const PERMISSION_PRESET_IDS = ['read-only', 'workspace-write', 'danger-full-access'] as const

export const LOCALE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
] as const

export const BUSY_ENTER_OPTIONS = [
  { value: 'queue', label: '排队发送', description: 'Enter 将消息加入队列' },
  { value: 'steer', label: '转向发送', description: 'Enter 中断并转向智能体' },
] as const

export const THEME_OPTIONS = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
] as const

export const ACCENT_COLOR_OPTIONS = [
  { value: 'neutral', label: '灰色' },
  { value: 'blue', label: '蓝色' },
  { value: 'green', label: '绿色' },
  { value: 'violet', label: '紫色' },
  { value: 'orange', label: '橙色' },
  { value: 'rose', label: '玫红' },
] as const

export type AccentColorId = (typeof ACCENT_COLOR_OPTIONS)[number]['value']

export const ACCENT_COLOR_SWATCHES: Record<AccentColorId, string> = {
  neutral: 'oklch(0.35 0.01 286)',
  blue: 'oklch(0.546 0.245 262.881)',
  green: 'oklch(0.527 0.154 150.069)',
  violet: 'oklch(0.541 0.281 293.009)',
  orange: 'oklch(0.646 0.222 41.116)',
  rose: 'oklch(0.586 0.253 17.585)',
}

/** Plugin-related settings namespaces shown in the Plugins tab. */
export const PLUGIN_SETTINGS_NAMESPACES = ['agent-loop', 'shell'] as const

export const LLM_PI_AI_NS = 'llm-pi-ai'
export const AGENT_DEFAULT_MODEL_NS = 'agent-default-model'

export const CUSTOM_PROVIDER_PROTOCOLS = [
  { value: 'openai-completions', label: 'OpenAI Completions' },
  { value: 'openai-responses', label: 'OpenAI Responses' },
  { value: 'anthropic-messages', label: 'Anthropic Messages' },
] as const

export const CUSTOM_PROVIDER_ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
