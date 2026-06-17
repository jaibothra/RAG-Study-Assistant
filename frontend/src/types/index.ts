export interface StudySpace {
  id: string
  name: string
  created_at: string
  document_count: number
}

export interface Session {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface Document {
  name: string
  size: number
}

export interface Source {
  filename: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  timestamp: Date
  isStreaming?: boolean
}

export type LoadingPhase = 'idle' | 'searching' | 'generating'

export interface ChatResponse {
  answer: string
  sources: string[]
  session_id: string
}

export interface UploadResponse {
  uploaded: string[]
}

export interface DocumentsResponse {
  documents: Document[]
}

export interface DocumentPreview {
  name: string
  size: number
  extension: string
  excerpt: string
  page_count: number | null
}

export interface RenameResponse {
  renamed: string
}
