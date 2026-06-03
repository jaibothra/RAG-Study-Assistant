import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/chatStore'
import ChatMessage from './ChatMessage'
import ThinkingIndicator from './ThinkingIndicator'

export default function ChatWindow() {
  const { messages, isLoading } = useChatStore()
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content

  return (
    <div className="h-full overflow-y-auto px-4 py-6 md:px-8">
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
