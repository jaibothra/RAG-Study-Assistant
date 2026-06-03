import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useChatStore } from './store/chatStore'
import ChatComposer from './components/ChatComposer'
import ChatWindow from './components/ChatWindow'
import DocumentPreviewPanel from './components/DocumentPreviewPanel'
import EmptyState from './components/EmptyState'
import Sidebar from './components/Sidebar'

export default function App() {
  const messages = useChatStore((state) => state.messages)
  const chatStarted = messages.length > 0
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[#0b0b0f] text-[#e5e5e5]">
      <Sidebar
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
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

        {!chatStarted ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8">
            <div className="flex w-full max-w-3xl flex-col items-center gap-8">
              <div className="-translate-y-7">
                <EmptyState />
              </div>
              <ChatComposer centered />
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1">
              <ChatWindow />
            </div>
            <ChatComposer centered={false} />
          </>
        )}
      </main>

      <DocumentPreviewPanel />
    </div>
  )
}
