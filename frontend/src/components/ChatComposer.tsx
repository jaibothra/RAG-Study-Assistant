import { useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Send } from 'lucide-react'
import { chatInSpace } from '../api/spaces'
import { useChatStore } from '../store/chatStore'
import { useSessionStore } from '../store/sessionStore'
import { useSpaceStore } from '../store/spaceStore'
import { streamText } from '../lib/utils'
import QuickActionChips from './QuickActionChips'

interface ChatComposerProps {
  centered: boolean
}

export default function ChatComposer({ centered }: ChatComposerProps) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState('')
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const activeSessionId = useSessionStore((state) =>
    activeSpaceId ? state.getActiveSessionId(activeSpaceId) : null,
  )
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const { addMessage, updateMessage, isLoading, setLoading, setLoadingPhase } = useChatStore()

  const canChat = Boolean(activeSpaceId)
  const placeholder = canChat
    ? 'Ask anything about your documents...'
    : 'Select a space to start chatting.'

  const submitCurrent = async () => {
    const content = input.trim()
    if (!content || isLoading || !activeSpaceId) {
      return
    }

    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    })
    setInput('')
    setLoading(true)
    setLoadingPhase('searching')

    await new Promise((resolve) => window.setTimeout(resolve, 550))
    setLoadingPhase('generating')

    try {
      const response = await chatInSpace(activeSpaceId, content, activeSessionId)
      setActiveSession(activeSpaceId, response.session_id)
      void queryClient.invalidateQueries({ queryKey: ['sessions', activeSpaceId] })
      const assistantId = crypto.randomUUID()
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        sources: response.sources,
        timestamp: new Date(),
        isStreaming: true,
      })
      streamText(
        response.answer,
        (value) => updateMessage(assistantId, { content: value }),
        () => {
          updateMessage(assistantId, { content: response.answer, isStreaming: false })
          setLoading(false)
          setLoadingPhase('idle')
        },
      )
    } catch {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        timestamp: new Date(),
      })
      setLoading(false)
      setLoadingPhase('idle')
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await submitCurrent()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submitCurrent()
    }
  }

  return (
    <motion.div
      layout
      transition={{ duration: 0.45, ease: 'easeInOut' }}
      className={
        centered
          ? 'w-full max-w-3xl px-6'
          : 'border-t border-[#2a2a35] bg-[#0b0b0f]/90 px-4 py-3 backdrop-blur-md'
      }
    >
      <div className="mx-auto w-full max-w-3xl">
        <form onSubmit={handleSubmit} className="relative">
          <div className="glass-input flex min-h-[52px] items-center gap-2 rounded-2xl px-3 py-1 shadow-xl shadow-black/25">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={isLoading || !canChat}
              rows={1}
              className="max-h-32 min-h-[36px] flex-1 resize-none border-0 bg-transparent py-2 text-sm leading-[36px] text-[#f4f4f5] outline-none placeholder:text-[#71717a] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim() || !canChat}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#7c5cff] text-white transition-all hover:scale-105 hover:bg-[#6b4df5] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
        {centered && canChat ? <QuickActionChips onSelect={setInput} /> : null}
      </div>
    </motion.div>
  )
}
