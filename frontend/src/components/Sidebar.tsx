import { BookOpen, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getSpaces } from '../api/spaces'
import DocumentList from './DocumentList'
import FileUpload from './FileUpload'
import StudySpacesSection from './StudySpacesSection'
import { useSpaceStore } from '../store/spaceStore'

interface SidebarProps {
  mobileOpen: boolean
  onMobileClose: () => void
  showCreateSpaceInput: boolean
  onShowCreateSpaceInput: () => void
  onHideCreateSpaceInput: () => void
}

export default function Sidebar({
  mobileOpen,
  onMobileClose,
  showCreateSpaceInput,
  onShowCreateSpaceInput,
  onHideCreateSpaceInput,
}: SidebarProps) {
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const setActiveSpace = useSpaceStore((state) => state.setActiveSpace)
  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: getSpaces,
  })
  const activeSpace = spaces.find((space) => space.id === activeSpaceId)
  const documentsHeading = activeSpace ? `${activeSpace.document_count} Documents` : 'Documents'
  const isHome = !activeSpaceId

  const goHome = () => {
    setActiveSpace(null)
    onMobileClose()
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/50 transition-opacity lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onMobileClose}
      />
      <aside
        className={`fixed top-0 left-0 z-40 flex h-screen w-[293px] shrink-0 flex-col border-r border-[#2a2a35] bg-[#111118] p-4 transition-transform duration-300 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-start justify-between">
          <button
            type="button"
            onClick={goHome}
            className={`-ml-1 rounded-xl px-1 py-1 text-left transition-colors ${
              isHome ? 'bg-[#171722]' : 'hover:bg-[#171722]/60'
            }`}
            aria-current={isHome ? 'page' : undefined}
          >
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-[#171722] p-1.5">
                <BookOpen size={18} className="text-[#7c5cff]" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[#f4f4f5]">StudyAI</h1>
            </div>
            <p className="mt-1 text-sm text-[#71717a]">Your AI learning companion</p>
          </button>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg border border-[#2a2a35] p-1.5 text-[#a1a1aa] lg:hidden"
          >
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <StudySpacesSection
            showCreateInput={showCreateSpaceInput}
            onShowCreateInput={onShowCreateSpaceInput}
            onHideCreateInput={onHideCreateSpaceInput}
          />

          <div className="border-t border-[#2a2a35] pt-3">
            <p className="mb-2 text-[10px] font-semibold tracking-wide text-[#71717a] uppercase">
              {documentsHeading}
            </p>
            {!activeSpaceId ? (
              <p className="text-xs text-[#71717a]">Select a subject to see documents.</p>
            ) : (
              <div className="space-y-2">
                <FileUpload spaceId={activeSpaceId} />
                <DocumentList spaceId={activeSpaceId} />
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
