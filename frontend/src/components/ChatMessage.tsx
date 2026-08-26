import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, Compass, Copy, Loader2, RotateCcw } from 'lucide-react'
import type { Message, NextSuggestion } from '../types'
import { getNextSuggestions } from '../api/sessions'
import { useChatStore } from '../store/chatStore'
import { chatInSpace } from '../api/spaces'
import { useSessionStore } from '../store/sessionStore'
import { useSpaceStore } from '../store/spaceStore'
import { streamText } from '../lib/utils'
import SourcePills from './SourcePills'
import MarkdownText from './MarkdownText'

interface ChatMessageProps {
  message: Message
  regeneratePrompt?: string
  isFirst?: boolean
  onSuggestions?: (suggestions: NextSuggestion[]) => void
}

function splitAnswerAndNudge(content: string): { answer: string; nudge: string | null } {
  const parts = content.split('\n\n')
  if (parts.length >= 2) {
    const nudge = parts[parts.length - 1].trim()
    const answer = parts.slice(0, -1).join('\n\n').trimEnd()
    return { answer, nudge }
  }
  return { answer: content, nudge: null }
}

export default function ChatMessage({ message, regeneratePrompt, isFirst = false, onSuggestions }: ChatMessageProps) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState(false)
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const activeSessionId = useSessionStore((state) =>
    activeSpaceId ? state.getActiveSessionId(activeSpaceId) : null,
  )
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const isUser = message.role === 'user'
  const { answer, nudge } =
    !isUser && !message.isStreaming ? splitAnswerAndNudge(message.content) : { answer: message.content, nudge: null as string | null }
  const {
    addMessage,
    updateMessage,
    removeLastAssistantMessage,
    setLoading,
    setLoadingPhase,
  } = useChatStore()

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const handleRegenerate = async () => {
    if (!regeneratePrompt || !activeSpaceId) {
      return
    }
    removeLastAssistantMessage()
    setLoading(true)
    setLoadingPhase('searching')
    await new Promise((resolve) => window.setTimeout(resolve, 500))
    setLoadingPhase('generating')

    try {
      const response = await chatInSpace(activeSpaceId, regeneratePrompt, activeSessionId)
      setActiveSession(activeSpaceId, response.session_id)
      void queryClient.invalidateQueries({ queryKey: ['sessions', activeSpaceId] })
      if (response.type === 'quiz' && response.quiz) {
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          type: 'quiz',
          quiz: response.quiz,
          timestamp: new Date(),
        })
        setLoading(false)
        setLoadingPhase('idle')
      } else {
        const assistantId = crypto.randomUUID()
        addMessage({
          id: assistantId,
          role: 'assistant',
          content: '',
          sources: response.sources,
          type: 'chat',
          timestamp: new Date(),
          isStreaming: true,
        })
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

  const handleExploreNext = async () => {
    if (suggestionsLoading || !activeSpaceId || !activeSessionId || !onSuggestions) return
    setSuggestionsLoading(true)
    setSuggestionsError(false)
    try {
      const suggestions = await getNextSuggestions(activeSpaceId, activeSessionId)
      onSuggestions(suggestions)
    } catch {
      setSuggestionsError(true)
      window.setTimeout(() => setSuggestionsError(false), 2000)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {isUser ? (
        <div className="max-w-[72%] rounded-2xl border border-[#2a2a35] bg-[#171722] px-4 py-3 shadow-lg shadow-black/20">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#f4f4f5]">
            {message.content}
          </p>
        </div>
      ) : (
        <div className="w-full rounded-2xl border border-[#2a2a35] bg-[#111118] px-5 py-4 shadow-lg shadow-black/20">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#e4e4e7]">
            <MarkdownText text={answer} />
            {message.isStreaming ? (
              <span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#7c5cff]" />
            ) : null}
          </p>
          {nudge ? (
            <p className="mt-5 block text-sm font-semibold text-[#b3bbc8]">
              <MarkdownText text={nudge} />
            </p>
          ) : null}
          {message.sources && message.sources.length > 0 ? (
            <SourcePills sources={message.sources} />
          ) : null}
          {!isFirst && !message.isStreaming && message.type !== 'quiz' && onSuggestions ? (
            <button
              type="button"
              onClick={() => void handleExploreNext()}
              disabled={suggestionsLoading}
              className="flex items-center gap-1.5 text-sm text-white hover:text-[#6366f1] transition-colors duration-150 cursor-pointer mt-4"
            >
              {suggestionsLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Compass size={15} className="text-[#6366f1]" />
              )}
              {suggestionsError ? (
                <span className="text-red-400">Couldn&apos;t load suggestions</span>
              ) : (
                'What should I explore next?'
              )}
            </button>
          ) : null}
          {!message.isStreaming ? (
            <div
              className={`mt-3 flex items-center gap-2 ${
                regeneratePrompt ? 'justify-between' : 'justify-end'
              }`}
            >
              {regeneratePrompt ? (
                <button
                  type="button"
                  onClick={() => void handleRegenerate()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a35] px-2.5 py-1 text-xs text-[#a1a1aa] transition-all hover:border-[#7c5cff] hover:text-[#e4e4e7]"
                >
                  <RotateCcw size={12} />
                  Regenerate
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 rounded-lg border border-[#2a2a35] px-2.5 py-1 text-xs text-[#a1a1aa] transition-all hover:border-[#7c5cff] hover:text-[#e4e4e7]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy Response'}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </motion.div>
  )
}
