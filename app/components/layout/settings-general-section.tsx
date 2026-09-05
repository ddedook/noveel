import { useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  ACCENT_COLOR_OPTIONS,
  ACCENT_COLOR_SWATCHES,
  BUSY_ENTER_OPTIONS,
  LOCALE_OPTIONS,
  PERMISSION_PRESET_IDS,
  PERMISSION_PRESET_LABELS,
  THEME_OPTIONS,
} from '@/app/lib/settings-constants'
import { useThemeStore } from '@/app/lib/theme-store'
import type { DshSettingsSnapshot } from '@/app/hooks/use-dsh-settings'
import { useSettingsNamespace } from '@/app/hooks/use-dsh-settings'
import {
  SettingsChoiceField,
  SettingsFieldRow,
  SettingsSelect,
} from '@/app/components/layout/settings-ui'

type AgentPresetOption = {
  id: string
  name?: string
  description?: string
}

type SettingsGeneralSectionProps = {
  snapshot: DshSettingsSnapshot
  onReload: () => void
}

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

export function SettingsGeneralSection({ snapshot, onReload }: SettingsGeneralSectionProps) {
  const { setTheme } = useTheme()
  const accentColor = useThemeStore((s) => s.accentColor)
  const setAccentColor = useThemeStore((s) => s.setAccentColor)
  const agentPresets = useSettingsNamespace(snapshot, 'agent-presets', onReload)
  const permission = useSettingsNamespace(snapshot, 'permission', onReload)
  const locale = useSettingsNamespace(snapshot, 'locale', onReload)
  const theme = useSettingsNamespace(snapshot, 'ui-theme', onReload)
  const conversation = useSettingsNamespace(snapshot, 'ui-conversation', onReload)

  const [presetOptions, setPresetOptions] = useState<AgentPresetOption[]>([])

  useEffect(() => {
    void window.ipcApi.dsh.agentPresetsList().then((roster) => {
      setPresetOptions(
        roster.presets.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
        })),
      )
    })
  }, [])

  const defaultPreset = String(
    (agentPresets.namespace?.value as { default?: string } | undefined)?.default ?? '',
  )
  const defaultPermission = String(
    (permission.namespace?.value as { defaultPreset?: string } | undefined)?.defaultPreset ??
      'workspace-write',
  )
  const localePref = String(
    (locale.namespace?.value as { preference?: string } | undefined)?.preference ?? 'zh',
  )
  const themePref = String(
    (theme.namespace?.value as { preference?: string } | undefined)?.preference ?? 'system',
  )
  const busyEnter = String(
    (conversation.namespace?.value as { busyEnter?: string } | undefined)?.busyEnter ?? 'queue',
  )

  const writable = snapshot.writable
  const resolvedDefaultPreset =
    defaultPreset && presetOptions.some((opt) => opt.id === defaultPreset)
      ? defaultPreset
      : (presetOptions[0]?.id ?? '')

  return (
    <div className="flex flex-col">
      <SettingsChoiceField
        title="Agent 预设"
        description="对此后新建的会话生效。运行中的会话保持它开始时的预设。"
        value={resolvedDefaultPreset}
        disabled={!writable || presetOptions.length === 0}
        columns={2}
        onChange={(value) => void agentPresets.mutate(['default'], value)}
        options={presetOptions.map((opt) => ({
          value: opt.id,
          label: opt.name ?? opt.id,
          description:
            opt.description ??
            (opt.name && opt.name !== opt.id ? opt.id : undefined),
        }))}
      />

      <SettingsFieldRow title="权限" description="选择新会话的默认权限模式">
        <SettingsSelect
          value={defaultPermission}
          disabled={!writable}
          onChange={(value) => void permission.mutate(['defaultPreset'], value)}
          options={PERMISSION_PRESET_IDS.map((id) => ({
            value: id,
            label: PERMISSION_PRESET_LABELS[id] ?? id,
          }))}
        />
      </SettingsFieldRow>

      <SettingsFieldRow
        title="语言"
        description="仅影响 DSH / Agent 侧文案；Noveel 应用界面暂不支持多语言。"
      >
        <SettingsSelect
          value={localePref}
          disabled={!writable}
          onChange={(value) => void locale.mutate(['preference'], value)}
          options={LOCALE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
        />
      </SettingsFieldRow>

      <SettingsChoiceField
        title="主题模式"
        description="控制 Noveel 界面与聊天区域的明暗外观"
        value={themePref as 'light' | 'dark' | 'system'}
        disabled={!writable}
        columns={3}
        onChange={(value) => {
          setTheme(value)
          void theme.mutate(['preference'], value)
        }}
        options={THEME_OPTIONS.map((opt) => {
          const Icon = THEME_ICONS[opt.value as keyof typeof THEME_ICONS]
          return {
            value: opt.value as 'light' | 'dark' | 'system',
            label: opt.label,
            icon: <Icon strokeWidth={1.5} />,
          }
        })}
      />

      <SettingsChoiceField
        title="主题颜色"
        description="调整按钮、链接与选中态的强调色"
        value={accentColor}
        columns={3}
        onChange={setAccentColor}
        options={ACCENT_COLOR_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
          swatch: ACCENT_COLOR_SWATCHES[opt.value],
        }))}
      />

      <SettingsFieldRow
        title="繁忙时 Enter 键行为"
        description="仅在智能体运行时生效；Cmd/Ctrl+Enter 使用另一行为"
        showSeparator={false}
      >
        <SettingsSelect
          value={busyEnter}
          disabled={!writable}
          onChange={(value) => void conversation.mutate(['busyEnter'], value)}
          options={BUSY_ENTER_OPTIONS.map((opt) => ({
            value: opt.value,
            label: opt.label,
          }))}
        />
      </SettingsFieldRow>
    </div>
  )
}
