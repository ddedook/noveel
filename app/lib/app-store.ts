import { create } from 'zustand'

export type NovelWorkspacePage =
  | 'basic'
  | 'overview'
  | 'world'
  | 'role'
  | 'creature'
  | 'item'
  | 'level'
  | 'timeline'
  | 'outline'
  | 'chapters'
  | 'template'
  | 'skills'

type AppStore = {
  currentNovelId: string | null
  currentSessionId: string | null
  chatPanelVisible: boolean
  currentPage: NovelWorkspacePage | null
  setCurrentNovelId: (id: string | null) => void
  setCurrentSessionId: (id: string | null) => void
  setChatPanelVisible: (visible: boolean) => void
  setCurrentPage: (page: NovelWorkspacePage | null) => void
}

export const useAppStore = create<AppStore>((set) => ({
  currentNovelId: null,
  currentSessionId: null,
  chatPanelVisible: true,
  currentPage: null,
  setCurrentNovelId: (id) => set({ currentNovelId: id }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setChatPanelVisible: (visible) => set({ chatPanelVisible: visible }),
  setCurrentPage: (page) => set({ currentPage: page }),
}))

export const NOVEL_FEATURE_TABS: Array<{ key: NovelWorkspacePage; label: string; path: string }> = [
  { key: 'basic', label: '基础', path: 'basic' },
  { key: 'overview', label: '概述', path: 'overview' },
  { key: 'world', label: '世界', path: 'world' },
  { key: 'role', label: '人物', path: 'role' },
  { key: 'creature', label: '生物', path: 'creature' },
  { key: 'item', label: '物品', path: 'item' },
  { key: 'level', label: '等级', path: 'level' },
  { key: 'timeline', label: '时间线', path: 'timeline' },
  { key: 'outline', label: '大纲', path: 'outline' },
  { key: 'chapters', label: '章节', path: 'chapters' },
  { key: 'template', label: '模板', path: 'template' },
  { key: 'skills', label: '技能', path: 'skills' },
]
