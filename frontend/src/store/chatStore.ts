import { create } from 'zustand'
import type { LoadingPhase, Message } from '../types'

interface ChatStore {
  messages: Message[]
  isLoading: boolean
  loadingPhase: LoadingPhase
  addMessage: (message: Message) => void
  loadSession: (messages: Message[]) => void
  updateMessage: (id: string, patch: Partial<Message>) => void
  removeLastAssistantMessage: () => void
  setLoading: (loading: boolean) => void
  setLoadingPhase: (phase: LoadingPhase) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isLoading: false,
  loadingPhase: 'idle',
  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),
  loadSession: (messages) =>
    set({
      messages,
      isLoading: false,
      loadingPhase: 'idle',
    }),
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    })),
  removeLastAssistantMessage: () =>
    set((state) => {
      const messages = [...state.messages]
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i].role === 'assistant') {
          messages.splice(i, 1)
          break
        }
      }
      return { messages }
    }),
  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingPhase: (phase) => set({ loadingPhase: phase }),
  clearMessages: () => set({ messages: [], isLoading: false, loadingPhase: 'idle' }),
}))
