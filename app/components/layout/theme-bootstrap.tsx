import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTheme } from 'next-themes'
import { applyAccentColor, useThemeStore } from '@/app/lib/theme-store'

export function ThemeBootstrap() {
  const { setTheme, theme } = useTheme()
  const accentColor = useThemeStore((s) => s.accentColor)
  const appliedFromServer = useRef(false)

  const themeQuery = useQuery({
    queryKey: ['dsh-settings-theme'],
    queryFn: () => window.ipcApi.dsh.settingsDescribe(),
    staleTime: 60_000,
  })

  useEffect(() => {
    applyAccentColor(accentColor)
  }, [accentColor])

  // Apply DSH preference once on first load so local next-themes storage stays authoritative after the user changes theme in settings.
  useEffect(() => {
    if (appliedFromServer.current || !themeQuery.data) return
    const ns = themeQuery.data.namespaces.find((n) => n.ns === 'ui-theme')
    const preference = (ns?.value as { preference?: string } | undefined)?.preference
    if (preference === 'light' || preference === 'dark' || preference === 'system') {
      if (theme !== preference) setTheme(preference)
      appliedFromServer.current = true
    }
  }, [themeQuery.data, setTheme, theme])

  return null
}
