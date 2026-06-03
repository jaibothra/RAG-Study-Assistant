import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { getDocuments } from '../api/documents'
import { useChatStore } from '../store/chatStore'

export default function ThinkingIndicator() {
  const loadingPhase = useChatStore((state) => state.loadingPhase)
  const isSearching = loadingPhase === 'searching'
  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
  })

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-[85%] rounded-2xl border border-[#2a2a35] bg-[#171722] px-4 py-3">
        <div className="mb-2 flex items-center gap-2 text-xs text-[#7c5cff]">
          <Search size={12} className={isSearching ? 'animate-pulse' : ''} />
          {isSearching ? 'Searching documents...' : 'Generating answer...'}
        </div>
        {isSearching && documents.length > 0 ? (
          <p className="mb-2 text-xs text-[#71717a]">
            Using {documents.length} document{documents.length === 1 ? '' : 's'}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-2 w-2 rounded-full bg-[#7c5cff]"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.9, 1.1, 0.9] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: dot * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
