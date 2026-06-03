import { create } from 'zustand'

interface UiStore {
  selectedDocument: string | null
  previewOpen: boolean
  sidebarOpen: boolean
  setSelectedDocument: (name: string | null) => void
  openPreview: (name: string) => void
  closePreview: () => void
  setSidebarOpen: (open: boolean) => void
}

export const useUiStore = create<UiStore>((set) => ({
  selectedDocument: null,
  previewOpen: false,
  sidebarOpen: false,
  setSelectedDocument: (name) => set({ selectedDocument: name }),
  openPreview: (name) => set({ selectedDocument: name, previewOpen: true }),
  closePreview: () => set({ previewOpen: false }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
