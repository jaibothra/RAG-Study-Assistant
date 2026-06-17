import { apiClient } from './client'
import type { ChatResponse } from '../types'

export const sendMessage = async (message: string): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>('/chat', { message })
  return response.data
}

export const chatInSpace = (
  spaceId: string,
  message: string,
  sessionId: string | null = null,
): Promise<ChatResponse> =>
  apiClient
    .post(`/spaces/${spaceId}/chat`, {
      message,
      session_id: sessionId,
    })
    .then((r) => r.data)
