import { apiClient } from './client'
import type {
  Document,
  DocumentPreview,
  DocumentsResponse,
  RenameResponse,
  UploadResponse,
} from '../types'

export const uploadDocuments = async (files: File[]): Promise<UploadResponse> => {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))

  const response = await apiClient.post<UploadResponse>('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response.data
}

export const getDocuments = async (): Promise<Document[]> => {
  const response = await apiClient.get<DocumentsResponse>('/documents')
  return response.data.documents
}

export const deleteDocument = async (filename: string): Promise<void> => {
  await apiClient.delete(`/documents/${encodeURIComponent(filename)}`)
}

export const renameDocument = async (
  filename: string,
  newName: string,
): Promise<RenameResponse> => {
  const response = await apiClient.patch<RenameResponse>(
    `/documents/${encodeURIComponent(filename)}`,
    { new_name: newName },
  )
  return response.data
}

export const getDocumentPreview = async (filename: string): Promise<DocumentPreview> => {
  const response = await apiClient.get<DocumentPreview>(
    `/documents/${encodeURIComponent(filename)}/preview`,
  )
  return response.data
}

export const getDocumentFileUrl = (filename: string): string =>
  `http://localhost:8000/documents/${encodeURIComponent(filename)}/file`
