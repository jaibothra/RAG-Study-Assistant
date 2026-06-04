import { motion } from 'framer-motion'
import { FolderOpen, Plus } from 'lucide-react'

interface NoSpacesEmptyStateProps {
  onCreateSpace: () => void
}

export default function NoSpacesEmptyState({ onCreateSpace }: NoSpacesEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mx-auto flex max-w-md flex-col items-center px-6 text-center"
    >
      <div className="mb-4 rounded-2xl border border-[#2a2a35] bg-[#171722] p-4">
        <FolderOpen size={32} className="text-[#7c5cff]" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-[#f4f4f5] md:text-3xl">
        Create your first study space
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#a1a1aa]">
        Organise your documents by topic. Each space has its own documents and chat.
      </p>
      <button
        type="button"
        onClick={onCreateSpace}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#7c5cff] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#6b4df5] hover:scale-[1.02] active:scale-[0.98]"
      >
        <Plus size={16} />
        Create Space
      </button>
    </motion.div>
  )
}
