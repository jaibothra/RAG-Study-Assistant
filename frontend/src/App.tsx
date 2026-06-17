import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { getSpaces } from './api/spaces'
import { useChatStore } from './store/chatStore'
import { useSessionStore } from './store/sessionStore'
import { useSpaceStore } from './store/spaceStore'
import ChatComposer from './components/ChatComposer'
import ChatWindow from './components/ChatWindow'
import DocumentPreviewPanel from './components/DocumentPreviewPanel'
import EmptyState from './components/EmptyState'
import NoSpacesEmptyState from './components/NoSpacesEmptyState'
import SelectSpaceEmptyState from './components/SelectSpaceEmptyState'
import Sidebar from './components/Sidebar'

export default function App() {
  const messages = useChatStore((state) => state.messages)
  const activeSpaceId = useSpaceStore((state) => state.activeSpaceId)
  const activeSessionId = useSessionStore((state) =>
    activeSpaceId ? state.getActiveSessionId(activeSpaceId) : null,
  )
  const setActiveSpace = useSpaceStore((state) => state.setActiveSpace)
  const chatStarted = messages.length > 0
  const hasSelectedSession = Boolean(activeSessionId)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [showCreateSpaceInput, setShowCreateSpaceInput] = useState(false)

  const { data: spaces = [], isLoading: spacesLoading } = useQuery({
    queryKey: ['spaces'],
    queryFn: getSpaces,
  })

  useEffect(() => {
    if (spacesLoading) {
      return
    }
    if (activeSpaceId && !spaces.some((space) => space.id === activeSpaceId)) {
      setActiveSpace(null)
    }
  }, [spacesLoading, spaces, activeSpaceId, setActiveSpace])

  const hasSpaces = spaces.length > 0
  const showNoSpaces = !spacesLoading && !hasSpaces
  const showSelectSpace = hasSpaces && !activeSpaceId

  const renderMainContent = () => {
    if (showNoSpaces) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <NoSpacesEmptyState onCreateSpace={() => setShowCreateSpaceInput(true)} />
        </div>
      )
    }

    if (showSelectSpace) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <SelectSpaceEmptyState />
        </div>
      )
    }

    if (!chatStarted && !hasSelectedSession) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
          <div className="flex w-full max-w-3xl flex-col items-center gap-8">
            <div className="-translate-y-7">
              <EmptyState />
            </div>
            <ChatComposer centered />
          </div>
        </div>
      )
    }

    return (
      <>
        <div className="min-h-0 flex-1">
          <ChatWindow />
        </div>
        <ChatComposer centered={false} />
      </>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0b0f] text-[#e5e5e5]">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        showCreateSpaceInput={showCreateSpaceInput}
        onShowCreateSpaceInput={() => setShowCreateSpaceInput(true)}
        onHideCreateSpaceInput={() => setShowCreateSpaceInput(false)}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-[#2a2a35] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="rounded-lg border border-[#2a2a35] p-2 text-[#a1a1aa]"
          >
            <Menu size={16} />
          </button>
          <p className="text-sm font-semibold text-[#f4f4f5]">StudyAI</p>
          <div className="w-8" />
        </header>

        {renderMainContent()}
      </main>

      <DocumentPreviewPanel />
    </div>
  )
}
