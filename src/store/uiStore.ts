import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'auto'

interface UIState {
  theme: Theme
  addSheetOpen: boolean
  setTheme: (theme: Theme) => void
  openAddSheet: () => void
  closeAddSheet: () => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) || 'light',
  addSheetOpen: false,
  setTheme: (theme) => {
    localStorage.setItem('theme', theme)
    set({ theme })
  },
  openAddSheet: () => set({ addSheetOpen: true }),
  closeAddSheet: () => set({ addSheetOpen: false }),
}))
