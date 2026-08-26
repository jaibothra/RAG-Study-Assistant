import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { chatInSpace, clearSpaceHistory } from '../api/spaces'
import { getSessionMessages } from '../api/sessions'
import { useChatStore } from '../store/chatStore'
import { useSessionStore } from '../store/sessionStore'
import { useSpaceStore } from '../store/spaceStore'
import type { NextSuggestion } from '../types'
import { streamText } from '../lib/utils'
import ChatMessage from './ChatMessage'
import QuizCard from './QuizCard'
import SuggestionCards from './SuggestionCards'
import ThinkingIndicator from './ThinkingIndicator'

export default function ChatWindow() {
  const { messages, isLoading, clearMessages, loadSession, addMessage, setLoading, setLoadingPhase, updateMessage } = useChatStore()
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const activeSessionId = useSessionStore((state) =>
    activeSpaceId ? state.getActiveSessionId(activeSpaceId) : null,
  )
  const queryClient = useQueryClient()
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const { data: sessionMessages } = useQuery({
    queryKey: ['session-messages', activeSpaceId, activeSessionId],
    queryFn: () => getSessionMessages(activeSpaceId as string, activeSessionId as string),
    enabled: Boolean(activeSpaceId) && Boolean(activeSessionId),
    refetchOnWindowFocus: false,
  })

  const handleClearChat = async () => {
    if (!activeSpaceId || !activeSessionId || clearing) {
      return
    }
    setClearing(true)
    try {
      await clearSpaceHistory(activeSpaceId, activeSessionId)
      clearMessages()
    } finally {
      setClearing(false)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  useEffect(() => {
    if (!activeSessionId) {
      return
    }
    loadSession(sessionMessages ?? [])
  }, [activeSessionId, sessionMessages, loadSession])

  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content
  const firstAssistantIndex = messages.findIndex((m) => m.role === 'assistant')

  const handleSuggestions = (suggestions: NextSuggestion[]) => {
    addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      type: 'suggestions',
      suggestions,
      timestamp: new Date(),
    })
  }

  const handleSuggestionSelect = async (concept: string) => {
    if (!activeSpaceId || isLoading) return
    const content = `Can you explain ${concept}?`
    addMessage({ id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() })
    setLoading(true)
    setLoadingPhase('searching')
    await new Promise((resolve) => window.setTimeout(resolve, 550))
    setLoadingPhase('generating')
    try {
      const response = await chatInSpace(activeSpaceId, content, activeSessionId)
      setActiveSession(activeSpaceId, response.session_id)
      void queryClient.invalidateQueries({ queryKey: ['sessions', activeSpaceId] })
      if (response.type === 'quiz' && response.quiz) {
        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', type: 'quiz', quiz: response.quiz, timestamp: new Date() })
        setLoading(false)
        setLoadingPhase('idle')
      } else if (response.type === 'suggestions' && response.suggestions) {
        addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', type: 'suggestions', suggestions: response.suggestions, timestamp: new Date() })
        setLoading(false)
        setLoadingPhase('idle')
      } else {
        const assistantId = crypto.randomUUID()
        addMessage({ id: assistantId, role: 'assistant', content: '', sources: response.sources, type: 'chat', timestamp: new Date(), isStreaming: true })
        streamText(
          response.answer ?? '',
          (value) => updateMessage(assistantId, { content: value }),
          () => {
            updateMessage(assistantId, { content: response.answer ?? '', isStreaming: false })
            setLoading(false)
            setLoadingPhase('idle')
          },
        )
      }
    } catch {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', content: 'Something went wrong. Please try again.', timestamp: new Date() })
      setLoading(false)
      setLoadingPhase('idle')
    }
  }

  return (
    <div className="relative h-full overflow-y-auto px-4 py-6 md:px-4">
      {messages.length > 0 && activeSpaceId ? (
        <button
          type="button"
          onClick={() => void handleClearChat()}
          disabled={clearing || isLoading}
          className="absolute right-4 top-3 z-10 text-xs text-[#71717a] transition-colors hover:text-[#a1a1aa] disabled:opacity-50"
        >
          {clearing ? 'Clearing…' : 'Clear chat'}
        </button>
      ) : null}
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {messages.map((message, index) => {
          const isLastAssistant =
            message.role === 'assistant' &&
            index === messages.length - 1 &&
            !message.isStreaming &&
            !isLoading
          return (
            <div key={message.id}>
              {message.type === 'suggestions' && message.suggestions ? (
                <SuggestionCards
                  suggestions={message.suggestions}
                  onSelect={(concept) => void handleSuggestionSelect(concept)}
                />
              ) : message.type === 'quiz' && message.quiz ? (
                <QuizCard quiz={message.quiz} />
              ) : (
                <ChatMessage
                  message={message}
                  regeneratePrompt={
                    isLastAssistant && lastUserMessage ? lastUserMessage : undefined
                  }
                  isFirst={index === firstAssistantIndex}
                  onSuggestions={handleSuggestions}
                />
              )}
            </div>
          )
        })}
        {isLoading ? <ThinkingIndicator /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
