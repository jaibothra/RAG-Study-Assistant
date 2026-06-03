import { motion } from 'framer-motion'

export default function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mx-auto flex w-full max-w-3xl flex-col items-center px-6 text-center"
    >
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="text-3xl font-bold tracking-tight text-[#f4f4f5] md:text-4xl"
      >
        What would you like to study today?
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.12 }}
        className="mt-4 max-w-xl text-sm leading-relaxed text-[#a1a1aa] md:text-base"
      >
        Upload notes, ask questions, generate summaries, and prepare for exams.
      </motion.p>
    </motion.div>
  )
}
