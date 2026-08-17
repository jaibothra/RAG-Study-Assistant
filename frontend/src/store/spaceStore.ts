import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { StudySpace } from '../types'
import { useChatStore } from './chatStore'
import { useUiStore } from './uiStore'

interface SpaceStore {
  spaces: StudySpace[]
  activeSpaceId: string | null
  setSpaces: (spaces: StudySpace[]) => void
  setActiveSpace: (id: string | null) => void
  addSpace: (space: StudySpace) => void
  removeSpace: (id: string) => void
  updateSpace: (id: string, name: string) => void
}

export const useSpaceStore = create<SpaceStore>()(
  persist(
    (set, get) => ({
      spaces: [],
      activeSpaceId: null,
      setSpaces: (spaces) => set({ spaces }),
      setActiveSpace: (id) => {
        if (id !== get().activeSpaceId) {
          useChatStore.getState().clearMessages()
          useUiStore.getState().closePreview()
          useUiStore.getState().setSelectedDocument(null)
        }
        set({ activeSpaceId: id })
      },
      addSpace: (space) =>
        set((state) => ({
          spaces: [...state.spaces, space],
        })),
      removeSpace: (id) => {
        const wasActive = get().activeSpaceId === id
        set((state) => ({
          spaces: state.spaces.filter((space) => space.id !== id),
          activeSpaceId: wasActive ? null : state.activeSpaceId,
        }))
        if (wasActive) {
          useChatStore.getState().clearMessages()
        }
      },
      updateSpace: (id, name) =>
        set((state) => ({
          spaces: state.spaces.map((space) =>
            space.id === id ? { ...space, name } : space,
          ),
        })),
    }),
    {
      name: 'study-spaces',
      // Do not persist activeSpaceId — app always lands on Home after refresh.
      partialize: () => ({}),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.activeSpaceId = null
        }
      },
    },
  ),
)
