import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deleteDocument, getDocuments, renameDocument } from '../api/documents'
import { formatSize, getFileEmoji } from '../lib/utils'
import { useUiStore } from '../store/uiStore'
import DocumentMenu from './DocumentMenu'

export default function DocumentList() {
  const queryClient = useQueryClient()
  const { selectedDocument, setSelectedDocument, openPreview } = useUiStore()
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const renameMutation = useMutation({
    mutationFn: ({ filename, newName }: { filename: string; newName: string }) =>
      renameDocument(filename, newName),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-14 animate-pulse rounded-xl bg-[#171722]" />
        ))}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-[#71717a]">No documents yet</p>
  }

  return (
    <div className="space-y-2">
      {data.map((document) => {
        const isSelected = selectedDocument === document.name
        return (
          <div
            key={document.name}
            role="button"
            tabIndex={0}
            onClick={() => {
              setSelectedDocument(document.name)
              openPreview(document.name)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                setSelectedDocument(document.name)
                openPreview(document.name)
              }
            }}
            className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 transition-all ${
              isSelected
                ? 'border-[#7c5cff] bg-[#171722] shadow-[0_0_0_1px_rgba(124,92,255,0.35)]'
                : 'border-[#2a2a35] bg-[#171722] hover:border-[#7c5cff66] hover:bg-[#1b1b27]'
            }`}
          >
            <span className="text-base">{getFileEmoji(document.name)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[#f4f4f5]">{document.name}</p>
              <p className="text-xs text-[#a1a1aa]">{formatSize(document.size)}</p>
            </div>
            <DocumentMenu
              open={menuOpenFor === document.name}
              onToggle={() =>
                setMenuOpenFor((current) =>
                  current === document.name ? null : document.name,
                )
              }
              onClose={() => setMenuOpenFor(null)}
              onOpen={() => openPreview(document.name)}
              onRename={() => {
                const newName = window.prompt('Rename file', document.name)
                if (newName && newName !== document.name) {
                  renameMutation.mutate({ filename: document.name, newName })
                }
              }}
              onDelete={() => {
                if (window.confirm(`Delete ${document.name}?`)) {
                  deleteMutation.mutate(document.name)
                }
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
