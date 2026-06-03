import axios, { AxiosError } from 'axios'

export const apiClient = axios.create({
  baseURL: 'http://localhost:8000',
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    const message = error.response?.data?.error ?? error.message ?? 'Request failed'
    throw new Error(message)
  },
)
