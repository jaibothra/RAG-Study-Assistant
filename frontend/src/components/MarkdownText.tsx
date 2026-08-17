import type { ReactNode } from 'react'

interface MarkdownTextProps {
  text: string
  className?: string
}

/**
 * Lightweight markdown renderer for chat answers.
 * Supports **bold**, *italic*, and `inline code` without adding packages.
 */
export default function MarkdownText({ text, className }: MarkdownTextProps) {
  return <span className={className}>{renderInlineMarkdown(text)}</span>
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Match **bold**, *italic*, or `code` — bold checked before italic
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    if (match[2] !== undefined) {
      nodes.push(
        <strong key={`b-${key++}`} className="font-semibold text-[#f4f4f5]">
          {match[2]}
        </strong>,
      )
    } else if (match[3] !== undefined) {
      nodes.push(
        <em key={`i-${key++}`} className="italic">
          {match[3]}
        </em>,
      )
    } else if (match[4] !== undefined) {
      nodes.push(
        <code
          key={`c-${key++}`}
          className="rounded bg-[#1a1a24] px-1 py-0.5 font-mono text-[0.85em] text-[#d4d4d8]"
        >
          {match[4]}
        </code>,
      )
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes.length > 0 ? nodes : [text]
}
