/** Layout constants aligned with dsh-desktop AdvancedFrame. */
export interface LayoutSnapshot {
  sidebar: number
  chat: number
  narrow: boolean
  narrowExpanded: boolean
}

export interface LayoutColumns {
  sidebar: number
  center: number
  chat: number
}

export const SIDEBAR_DEFAULT = 280
export const SIDEBAR_MIN = 264
export const SIDEBAR_MAX = 420
export const SIDEBAR_AUTO_COLLAPSE = 1024
export const CHAT_DEFAULT = 360
export const CHAT_MIN = 300
export const CHAT_MAX = 520
export const CENTER_MIN = 640

export function computeLayoutColumns(
  viewport: number,
  sidebar: number,
  chat: number,
): LayoutColumns {
  const sidebarWidth =
    sidebar === 0 ? 0 : clamp(sidebar, SIDEBAR_MIN, SIDEBAR_MAX)
  const preferredChat = chat === 0 ? 0 : clamp(chat, CHAT_MIN, CHAT_MAX)
  if (sidebarWidth + preferredChat + CENTER_MIN <= viewport) {
    return {
      sidebar: sidebarWidth,
      center: viewport - sidebarWidth - preferredChat,
      chat: preferredChat,
    }
  }
  const reducedChat =
    preferredChat === 0 ? 0 : Math.max(CHAT_MIN, viewport - sidebarWidth - CENTER_MIN)
  if (sidebarWidth + reducedChat + CENTER_MIN <= viewport) {
    return { sidebar: sidebarWidth, center: CENTER_MIN, chat: reducedChat }
  }
  return { sidebar: sidebarWidth, center: Math.max(0, viewport - sidebarWidth), chat: 0 }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)))
}

export function isSidebarCollapsed(snapshot: LayoutSnapshot, narrow: boolean): boolean {
  if (narrow) return !snapshot.narrowExpanded
  return snapshot.sidebar === 0
}

export function effectiveSidebarPreference(snapshot: LayoutSnapshot, narrow: boolean): number {
  const collapsed = isSidebarCollapsed(snapshot, narrow)
  if (collapsed) return 0
  return snapshot.sidebar === 0 ? SIDEBAR_DEFAULT : snapshot.sidebar
}
