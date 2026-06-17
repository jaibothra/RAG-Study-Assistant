import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clearSpaceHistory } from '../api/spaces'
import { getSessionMessages } from '../api/sessions'
import { useChatStore } from '../store/chatStore'
import { useSessionStore } from '../store/sessionStore'
import { useSpaceStore } from '../store/spaceStore'
import ChatMessage from './ChatMessage'
import ThinkingIndicator from './ThinkingIndicator'

export default function ChatWindow() {
  const { messages, isLoading, clearMessages, loadSession } = useChatStore()
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const activeSessionId = useSessionStore((state) =>
    activeSpaceId ? state.getActiveSessionId(activeSpaceId) : null,
  )
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const { data: sessionMessages } = useQuery({
    queryKey: ['session-messages', activeSpaceId, activeSessionId],
    queryFn: () => getSessionMessages(activeSpaceId as string, activeSessionId as string),
    enabled: Boolean(activeSpaceId) && Boolean(activeSessionId),
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

  return (
    <div className="relative h-full overflow-y-auto px-4 py-6 md:px-8">
      {messages.length > 0 && activeSpaceId ? (
        <button
          type="button"
          onClick={() => void handleClearChat()}
          disabled={clearing || isLoading}
          className="absolute right-4 top-3 z-10 text-xs text-[#71717a] transition-colors hover:text-[#a1a1aa] disabled:opacity-50 md:right-8"
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
            <ChatMessage
              key={message.id}
              message={message}
              regeneratePrompt={
                isLastAssistant && lastUserMessage ? lastUserMessage : undefined
              }
            />
          )
        })}
        {isLoading ? <ThinkingIndicator /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
