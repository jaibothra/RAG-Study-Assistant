import { apiClient } from './client'
import type {
  ChatResponse,
  Document,
  DocumentPreview,
  StudySpace,
  UploadResponse,
} from '../types'

interface SpaceCreated {
  id: string
  name: string
  created_at: string
}

interface DocumentsResponse {
  documents: Document[]
}

export const getSpaces = async (): Promise<StudySpace[]> => {
  const response = await apiClient.get<StudySpace[]>('/spaces')
  return response.data
}

export const createSpace = async (name: string): Promise<StudySpace> => {
  const response = await apiClient.post<SpaceCreated>('/spaces', { name })
  return { ...response.data, document_count: 0 }
}

export const deleteSpace = async (spaceId: string): Promise<void> => {
  await apiClient.delete(`/spaces/${encodeURIComponent(spaceId)}`)
}

export const renameSpace = async (spaceId: string, name: string): Promise<StudySpace> => {
  const response = await apiClient.patch<SpaceCreated>(`/spaces/${encodeURIComponent(spaceId)}`, {
    name,
  })
  const spaces = await getSpaces()
  const match = spaces.find((space) => space.id === spaceId)
  return {
    ...response.data,
    document_count: match?.document_count ?? 0,
  }
}

export const uploadToSpace = async (
  spaceId: string,
  files: File[],
): Promise<UploadResponse> => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const response = await apiClient.post<UploadResponse>(
    `/spaces/${encodeURIComponent(spaceId)}/upload`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return response.data
}

export const getSpaceDocuments = async (spaceId: string): Promise<Document[]> => {
  const response = await apiClient.get<DocumentsResponse>(
    `/spaces/${encodeURIComponent(spaceId)}/documents`,
  )
  return response.data.documents
}

export const deleteSpaceDocument = async (
  spaceId: string,
  filename: string,
): Promise<void> => {
  await apiClient.delete(
    `/spaces/${encodeURIComponent(spaceId)}/documents/${encodeURIComponent(filename)}`,
  )
}

export const chatInSpace = async (spaceId: string, message: string): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>(
    `/spaces/${encodeURIComponent(spaceId)}/chat`,
    { message },
  )
  return response.data
}

export const getSpaceDocumentPreview = async (
  spaceId: string,
  filename: string,
): Promise<DocumentPreview> => {
  const response = await apiClient.get<DocumentPreview>(
    `/spaces/${encodeURIComponent(spaceId)}/documents/${encodeURIComponent(filename)}/preview`,
  )
  return response.data
}

export const getSpaceDocumentFileUrl = (spaceId: string, filename: string): string =>
  `http://localhost:8000/spaces/${encodeURIComponent(spaceId)}/documents/${encodeURIComponent(filename)}/file`
