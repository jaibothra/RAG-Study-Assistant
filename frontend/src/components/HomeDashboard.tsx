import { motion } from 'framer-motion'
import { BookOpen, FileText, Plus } from 'lucide-react'
import type { StudySpace } from '../types'
import { useSpaceStore } from '../store/spaceStore'

interface HomeDashboardProps {
  spaces: StudySpace[]
  isLoading?: boolean
  onCreateSpace: () => void
}

function formatCreatedAt(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Recently added'
  }

  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  if (diffDays === 0) {
    return 'Today'
  }
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`
  }

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function HomeDashboard({
  spaces,
  isLoading = false,
  onCreateSpace,
}: HomeDashboardProps) {
  const setActiveSpace = useSpaceStore((state) => state.setActiveSpace)
  const hasSpaces = spaces.length > 0

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,92,255,0.12)_0%,_transparent_55%)]"
      />

      <div className="relative mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="flex shrink-0 items-center justify-center pt-[14vh] md:pt-[16vh]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#2a2a35] bg-[#171722]">
            <BookOpen size={22} className="text-[#7c5cff]" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
          className="flex w-full shrink-0 flex-col items-center pt-[10vh] text-center md:pt-[12vh]"
        >
          <h1 className="whitespace-nowrap text-2xl font-bold tracking-tight text-[#f4f4f5] sm:text-3xl md:text-4xl">
            What would you like to study today?
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#a1a1aa] md:text-base">
            Choose a subject to continue, or create a new one for your notes.
          </p>
        </motion.div>

        {!isLoading && !hasSpaces ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="mt-32 flex w-full max-w-md shrink-0 flex-col items-center text-center md:mt-40"
          >
            <p className="text-sm leading-relaxed text-[#71717a]">
              Organise your documents by topic. Each subject keeps its own files and conversations.
            </p>
            <button
              type="button"
              onClick={onCreateSpace}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#7c5cff] px-5 py-2.5 text-sm font-medium text-white transition-all hover:scale-[1.02] hover:bg-[#6b4df5] active:scale-[0.98]"
            >
              <Plus size={16} />
              Create Subject
            </button>
          </motion.div>
        ) : null}

        {!isLoading && hasSpaces ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="mt-32 flex min-h-0 w-full flex-1 flex-col md:mt-40"
          >
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <p className="text-xs font-semibold tracking-wide text-[#71717a] uppercase">
                Your subjects
              </p>
              <button
                type="button"
                onClick={onCreateSpace}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2a2a35] bg-[#171722] px-3 py-1.5 text-xs font-medium text-[#e4e4e7] transition-colors hover:border-[#7c5cff66] hover:text-white"
              >
                <Plus size={14} />
                New subject
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:#2f2f2f_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-[#2f2f2f] [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="grid gap-3 pb-2 sm:grid-cols-2">
                {spaces.map((space, index) => (
                  <motion.button
                    key={space.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.04 * index }}
                    onClick={() => setActiveSpace(space.id)}
                    className="group rounded-2xl border border-[#2a2a35] bg-[#111118] px-4 py-4 text-left transition-all hover:border-[#7c5cff66] hover:bg-[#171722]"
                  >
                    <p className="truncate text-sm font-semibold text-[#f4f4f5] group-hover:text-white">
                      {space.name}
                    </p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-[#71717a]">
                      <span className="inline-flex items-center gap-1">
                        <FileText size={12} />
                        {space.document_count}{' '}
                        {space.document_count === 1 ? 'document' : 'documents'}
                      </span>
                      <span>{formatCreatedAt(space.created_at)}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
