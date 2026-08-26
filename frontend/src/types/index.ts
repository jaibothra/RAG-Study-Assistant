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
  type?: 'chat' | 'quiz' | 'suggestions'
  quiz?: QuizData
  suggestions?: NextSuggestion[]
  isStreaming?: boolean
}

export type LoadingPhase = 'idle' | 'searching' | 'generating'

export interface QuizOption {
  A: string
  B: string
  C: string
  D: string
}

export interface QuizQuestion {
  id: number
  question: string
  options: QuizOption
  correct: 'A' | 'B' | 'C' | 'D'
  explanation: string
  concept: string
}

export interface QuizData {
  topic: string
  questions: QuizQuestion[]
}

export interface NextSuggestion {
  concept: string
  reason: string
}

export interface ChatResponse {
  type: 'chat' | 'quiz' | 'suggestions'
  answer?: string
  sources?: string[]
  session_id: string
  quiz?: QuizData
  suggestions?: NextSuggestion[]
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
