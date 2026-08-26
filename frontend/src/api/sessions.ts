import { apiClient } from './client'
import type { Message, NextSuggestion, Session } from '../types'

export const getSessions = (spaceId: string): Promise<Session[]> =>
  apiClient.get(`/spaces/${spaceId}/sessions`).then((r) => r.data.sessions)

export const deleteSession = (spaceId: string, sessionId: string): Promise<void> =>
  apiClient.delete(`/spaces/${spaceId}/sessions/${sessionId}`)

export const clearSessionHistory = (spaceId: string, sessionId: string): Promise<void> =>
  apiClient.delete(`/spaces/${spaceId}/sessions/${sessionId}/history`)

export const getSessionMessages = (
  spaceId: string,
  sessionId: string,
): Promise<Message[]> =>
  apiClient
    .get(`/spaces/${spaceId}/sessions/${sessionId}/messages`)
    .then((r) =>
      r.data.messages.map(
        (message: {
          role: 'user' | 'assistant'
          content: string
          sources?: string[]
          created_at?: string | null
        }) => ({
          id: crypto.randomUUID(),
          role: message.role,
          content: message.content,
          sources: message.sources ?? [],
          timestamp: message.created_at ? new Date(message.created_at) : new Date(),
          isStreaming: false,
        }),
      ),
    )

export const getNextSuggestions = (
  spaceId: string,
  sessionId: string,
): Promise<NextSuggestion[]> =>
  apiClient
    .post(`/spaces/${spaceId}/sessions/${sessionId}/suggestions`)
    .then((r) => r.data.suggestions)
