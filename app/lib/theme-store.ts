import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AccentColorId } from '@/app/lib/settings-constants'

type ThemeStore = {
  accentColor: AccentColorId
  setAccentColor: (id: AccentColorId) => void
}

export function applyAccentColor(accentColor: AccentColorId) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.themeColor = accentColor
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      accentColor: 'neutral',
      setAccentColor: (id) => {
        applyAccentColor(id)
        set({ accentColor: id })
      },
    }),
    {
      name: 'noveel-theme-store',
      onRehydrateStorage: () => (state) => {
        if (state?.accentColor) applyAccentColor(state.accentColor)
      },
    },
  ),
)
