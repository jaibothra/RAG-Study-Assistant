import { apiClient } from './client'
import type { ChatResponse } from '../types'

export const sendMessage = async (message: string): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>('/chat', { message })
  return response.data
}
