import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { getDocumentFileUrl, getDocumentPreview } from '../api/documents'
import { formatSize, getFileExtension } from '../lib/utils'
import { useUiStore } from '../store/uiStore'

export default function DocumentPreviewPanel() {
  const { previewOpen, selectedDocument, closePreview } = useUiStore()
  const [searchQuery, setSearchQuery] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['document-preview', selectedDocument],
    queryFn: () => getDocumentPreview(selectedDocument as string),
    enabled: previewOpen && Boolean(selectedDocument),
  })

  const filteredExcerpt = useMemo(() => {
    if (!data?.excerpt) {
      return ''
    }
    if (!searchQuery.trim()) {
      return data.excerpt
    }
    const query = searchQuery.toLowerCase()
    const lines = data.excerpt.split('\n')
    const matches = lines.filter((line) => line.toLowerCase().includes(query))
    return matches.length > 0 ? matches.join('\n') : 'No matches found in preview.'
  }, [data?.excerpt, searchQuery])

  const isPdf = data ? getFileExtension(data.name) === '.pdf' : false

  return (
    <AnimatePresence>
      {previewOpen && selectedDocument ? (
        <>
          <motion.button
            type="button"
            aria-label="Close preview overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePreview}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] lg:bg-black/35"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="fixed top-0 right-0 z-50 flex h-full w-full max-w-xl flex-col border-l border-[#2a2a35] bg-[#111118] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#2a2a35] px-5 py-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-[#f4f4f5]">
                  {selectedDocument}
                </h3>
                {data ? (
                  <p className="mt-1 text-xs text-[#a1a1aa]">
                    {formatSize(data.size)}
                    {data.page_count ? ` · ${data.page_count} pages` : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closePreview}
                className="rounded-lg border border-[#2a2a35] p-2 text-[#a1a1aa] transition-all hover:text-[#f4f4f5]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="border-b border-[#2a2a35] px-5 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-[#2a2a35] bg-[#171722] px-3 py-2">
                <Search size={14} className="text-[#71717a]" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search within document..."
                  className="w-full bg-transparent text-sm text-[#e4e4e7] outline-none placeholder:text-[#71717a]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-4 animate-pulse rounded bg-[#171722]" />
                  ))}
                </div>
              ) : null}
              {!isLoading && data && isPdf ? (
                <iframe
                  title={data.name}
                  src={getDocumentFileUrl(data.name)}
                  className="h-[70vh] w-full rounded-xl border border-[#2a2a35] bg-white"
                />
              ) : null}
              {!isLoading && data && !isPdf ? (
                <pre className="rounded-xl border border-[#2a2a35] bg-[#171722] p-4 text-xs leading-relaxed whitespace-pre-wrap text-[#d4d4d8]">
                  {filteredExcerpt || 'No preview available for this file type.'}
                </pre>
              ) : null}
              {!isLoading && data && isPdf && filteredExcerpt ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-[#7c5cff] uppercase">
                    Text Preview
                  </p>
                  <pre className="rounded-xl border border-[#2a2a35] bg-[#171722] p-4 text-xs leading-relaxed whitespace-pre-wrap text-[#d4d4d8]">
                    {filteredExcerpt}
                  </pre>
                </div>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}
