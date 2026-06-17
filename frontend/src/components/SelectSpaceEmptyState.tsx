import { motion } from 'framer-motion'
import { Layers } from 'lucide-react'

export default function SelectSpaceEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="mx-auto flex max-w-md flex-col items-center px-6 text-center"
    >
      <div className="mb-4 rounded-2xl border border-[#2a2a35] bg-[#171722] p-4">
        <Layers size={28} className="text-[#71717a]" />
      </div>
      <p className="text-base text-[#a1a1aa]">Select a subject from the sidebar to begin.</p>
    </motion.div>
  )
}
