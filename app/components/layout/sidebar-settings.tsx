import { useEffect, useState } from 'react'
import { Settings, X } from 'lucide-react'
import { Button } from '@heroui/react'
import {
  SETTINGS_NAV_ICONS,
  SETTINGS_TAB_IDS,
  formatSettingsSectionLabel,
} from '@/app/components/layout/settings-nav-labels'
import { SettingsGeneralSection } from '@/app/components/layout/settings-general-section'
import { SettingsModelsSection } from '@/app/components/layout/settings-models-section'
import { SettingsCursorSection } from '@/app/components/layout/settings-cursor-section'
import type { DshSettingsSnapshot, SettingsNamespaceView } from '@/app/hooks/use-dsh-settings'
import type { SettingsTabId } from '@/app/lib/settings-constants'
import { cn } from '@/app/lib/utils'

export function SidebarSettings() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [snapshot, setSnapshot] = useState<DshSettingsSnapshot | null>(null)
  const [activeTab, setActiveTab] = useState<SettingsTabId>('general')
  const [error, setError] = useState<string | null>(null)

  async function loadSettings(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false
    if (!silent) setLoading(true)
    setError(null)
    try {
      const data = await window.ipcApi.dsh.settingsDescribe()
      const namespaces: SettingsNamespaceView[] = data.namespaces.map((item) => ({
        ns: String(item.ns),
        schema: item.schema,
        value: item.value,
        user: item.user,
        base: item.base,
        revision: typeof item.revision === 'number' ? item.revision : undefined,
      }))
      setSnapshot({
        writable: data.writable,
        hasDocument: data.hasDocument,
        namespaces,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void loadSettings()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="noveel-settings-trigger w-full justify-start gap-2 px-3 font-normal"
        onPress={() => setOpen(true)}
        aria-label="设置"
      >
        <Settings data-icon="inline-start" />
        设置
      </Button>

      {open ? (
        <div className="noveel-settings-overlay" role="dialog" aria-modal="true" aria-label="设置">
          <button
            type="button"
            className="noveel-settings-mask"
            aria-label="关闭设置"
            onClick={() => setOpen(false)}
          />
          <div className="noveel-settings-panel">
            <nav className="noveel-settings-nav">
              <p className="px-3 pb-2 text-sm font-medium">设置</p>
              {SETTINGS_TAB_IDS.map((tabId) => {
                const Icon = SETTINGS_NAV_ICONS[tabId]
                return (
                  <Button
                    key={tabId}
                    type="button"
                    variant="ghost"
                    className={cn(
                      'noveel-settings-nav-cell h-auto w-full justify-start gap-2 px-3 py-2 font-normal active:scale-[0.96]',
                      activeTab === tabId && 'is-active',
                    )}
                    onPress={() => setActiveTab(tabId)}
                  >
                    {Icon ? <Icon data-icon="inline-start" /> : null}
                    {formatSettingsSectionLabel(tabId)}
                  </Button>
                )
              })}
            </nav>
            <div className="noveel-settings-body">
              <div className="noveel-settings-header">
                <h2 className="text-base font-medium">{formatSettingsSectionLabel(activeTab)}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  isIconOnly
                  size="sm"
                  aria-label="关闭"
                  onPress={() => setOpen(false)}
                >
                  <X />
                </Button>
              </div>
              <div className="noveel-settings-content">
                {loading && !snapshot ? (
                  <p className="text-muted text-sm">加载中…</p>
                ) : null}
                {error ? <p className="text-danger text-sm">{error}</p> : null}
                {snapshot ? (
                  <>
                    {activeTab === 'general' ? (
                      <SettingsGeneralSection
                        snapshot={snapshot}
                        onReload={() => void loadSettings({ silent: true })}
                      />
                    ) : null}
                    {activeTab === 'models' ? (
                      <SettingsModelsSection
                        snapshot={snapshot}
                        onReload={() => void loadSettings({ silent: true })}
                      />
                    ) : null}
                    {activeTab === 'cursor' ? <SettingsCursorSection /> : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
