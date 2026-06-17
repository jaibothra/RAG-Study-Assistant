import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session } from '../types'

interface SessionStore {
  activeSessionIds: Record<string, string | null>
  sessions: Record<string, Session[]>
  setActiveSession: (spaceId: string, sessionId: string | null) => void
  setSessions: (spaceId: string, sessions: Session[]) => void
  addSession: (spaceId: string, session: Session) => void
  removeSession: (spaceId: string, sessionId: string) => void
  getActiveSessionId: (spaceId: string) => string | null
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      activeSessionIds: {},
      sessions: {},
      setActiveSession: (spaceId, sessionId) =>
        set((state) => ({
          activeSessionIds: { ...state.activeSessionIds, [spaceId]: sessionId },
        })),
      setSessions: (spaceId, sessions) =>
        set((state) => ({
          sessions: { ...state.sessions, [spaceId]: sessions },
        })),
      addSession: (spaceId, session) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [spaceId]: [session, ...(state.sessions[spaceId] || [])],
          },
        })),
      removeSession: (spaceId, sessionId) =>
        set((state) => ({
          sessions: {
            ...state.sessions,
            [spaceId]: (state.sessions[spaceId] || []).filter((s) => s.id !== sessionId),
          },
        })),
      getActiveSessionId: (spaceId) => get().activeSessionIds[spaceId] ?? null,
    }),
    { name: 'session-store' },
  ),
)
