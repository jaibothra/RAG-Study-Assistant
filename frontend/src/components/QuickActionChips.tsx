interface QuickActionChipsProps {
  onSelect: (prompt: string) => void
}

const chips = [
  { emoji: '📖', label: 'Summarize notes', prompt: 'Summarize my notes' },
  { emoji: '📝', label: 'Generate questions', prompt: 'Generate exam questions from my documents' },
  { emoji: '🎯', label: 'Explain concepts', prompt: 'Explain the difficult concepts in my notes' },
]

export default function QuickActionChips({ onSelect }: QuickActionChipsProps) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => onSelect(chip.prompt)}
          className="rounded-full border border-[#2a2a35] bg-[#171722] px-4 py-2 text-sm text-[#a1a1aa] transition-all hover:border-[#7c5cff66] hover:bg-[#1b1b27] hover:text-[#e4e4e7]"
        >
          <span className="mr-1.5">{chip.emoji}</span>
          {chip.label}
        </button>
      ))}
    </div>
  )
}
