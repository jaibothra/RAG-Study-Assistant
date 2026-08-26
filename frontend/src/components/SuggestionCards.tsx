import { motion } from 'framer-motion'
import type { NextSuggestion } from '../types'

interface SuggestionCardsProps {
  suggestions: NextSuggestion[]
  onSelect: (concept: string) => void
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
}

const item = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0 },
}

export default function SuggestionCards({ suggestions, onSelect }: SuggestionCardsProps) {
  return (
    <div className="border-l-2 border-[#6366f1] pl-4">
      <p className="mb-3 text-sm text-white">Here&apos;s what to explore next:</p>
      <motion.div variants={container} initial="hidden" animate="show">
        {suggestions.map((s) => (
          <motion.button
            key={s.concept}
            type="button"
            variants={item}
            onClick={() => onSelect(s.concept)}
            className="w-full bg-[#111111] border border-[#1e1e1e] rounded-xl px-4 py-3 mb-2 last:mb-0 cursor-pointer hover:border-[#6366f1] hover:bg-[#16163a] transition-all duration-150 text-left"
          >
            <div>
              <span className="text-sm font-medium text-[#e5e5e5]">{s.concept}</span>
              <p className="text-xs text-[#71717a] mt-0.5">{s.reason}</p>
            </div>
          </motion.button>
        ))}
      </motion.div>
    </div>
  )
}
