import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  CHAT_DEFAULT,
  SIDEBAR_DEFAULT,
  type LayoutSnapshot,
} from '@/app/lib/layout-state'

type LayoutStore = LayoutSnapshot & {
  toggleSidebar: () => void
  toggleChat: () => void
  setSidebar: (width: number) => void
  setChat: (width: number) => void
  setNarrow: (narrow: boolean) => void
  openChat: () => void
  closeChat: () => void
}

export const useLayoutStore = create<LayoutStore>()(
  persist(
    (set, get) => ({
      sidebar: SIDEBAR_DEFAULT,
      chat: CHAT_DEFAULT,
      narrow: false,
      narrowExpanded: false,
      toggleSidebar: () => {
        const s = get()
        if (s.narrow) {
          set({ narrowExpanded: !s.narrowExpanded })
          return
        }
        set({ sidebar: s.sidebar === 0 ? SIDEBAR_DEFAULT : 0 })
      },
      toggleChat: () => {
        const s = get()
        set({ chat: s.chat === 0 ? CHAT_DEFAULT : 0 })
      },
      openChat: () => {
        if (get().chat === 0) set({ chat: CHAT_DEFAULT })
      },
      closeChat: () => set({ chat: 0 }),
      setSidebar: (width) => set({ sidebar: width }),
      setChat: (width) => set({ chat: width }),
      setNarrow: (narrow) => {
        if (get().narrow === narrow) return
        set({ narrow, narrowExpanded: false })
      },
    }),
    { name: 'noveel-layout' },
  ),
)
