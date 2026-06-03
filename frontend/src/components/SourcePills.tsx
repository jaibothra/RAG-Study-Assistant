import { FileText } from 'lucide-react'

interface SourcePillsProps {
  sources: string[]
}

export default function SourcePills({ sources }: SourcePillsProps) {
  if (!sources.length) {
    return null
  }

  return (
    <div className="mt-4 border-t border-[#2a2a35] pt-3">
      <p className="mb-2 text-xs font-semibold tracking-wide text-[#7c5cff] uppercase">
        Sources Used
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => (
          <span
            key={source}
            className="inline-flex items-center gap-1 rounded-full border border-[#2a2a35] bg-[#111118] px-2.5 py-1 text-xs text-[#a1a1aa]"
          >
            <FileText size={12} className="text-[#7c5cff]" />
            {source}
          </span>
        ))}
      </div>
    </div>
  )
}
