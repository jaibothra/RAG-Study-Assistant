import { useEffect, useRef } from 'react'
import { MoreHorizontal } from 'lucide-react'

interface DocumentMenuProps {
  open: boolean
  onToggle: () => void
  onClose: () => void
  onOpen: () => void
  onRename: () => void
  onDelete: () => void
  showRename?: boolean
}

export default function DocumentMenu({
  open,
  onToggle,
  onClose,
  onOpen,
  onRename,
  onDelete,
  showRename = true,
}: DocumentMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, onClose])

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className="rounded-md p-1 text-[#71717a] opacity-0 transition-all group-hover:opacity-100 hover:bg-[#171722] hover:text-[#e4e4e7]"
        aria-label="Document actions"
      >
        <MoreHorizontal size={14} />
      </button>
      {open ? (
        <div className="absolute top-7 right-0 z-20 min-w-[130px] rounded-xl border border-[#2a2a35] bg-[#171722] p-1 shadow-xl">
          <button
            type="button"
            onClick={() => {
              onOpen()
              onClose()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-[#e4e4e7] hover:bg-[#111118]"
          >
            Open
          </button>
          {showRename ? (
            <button
              type="button"
              onClick={() => {
                onRename()
                onClose()
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-xs text-[#e4e4e7] hover:bg-[#111118]"
            >
              Rename
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onDelete()
              onClose()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-xs text-red-400 hover:bg-[#111118]"
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  )
}
