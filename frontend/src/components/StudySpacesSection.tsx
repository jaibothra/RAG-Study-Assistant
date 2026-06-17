import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock3, MoreHorizontal, Plus, Trash2, X } from 'lucide-react'
import { createSpace, deleteSpace, getSpaces, renameSpace } from '../api/spaces'
import { deleteSession, getSessions } from '../api/sessions'
import { useChatStore } from '../store/chatStore'
import { useSessionStore } from '../store/sessionStore'
import { useSpaceStore } from '../store/spaceStore'
import type { StudySpace } from '../types'

interface SpaceRowProps {
  space: StudySpace
  isActive: boolean
  onSelect: () => void
}

function SpaceRow({ space, isActive, onSelect }: SpaceRowProps) {
  const queryClient = useQueryClient()
  const { removeSpace, updateSpace } = useSpaceStore()
  const clearMessages = useChatStore((state) => state.clearMessages)
  const setActiveSession = useSessionStore((state) => state.setActiveSession)
  const activeSessionId = useSessionStore((state) => state.getActiveSessionId(space.id))
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(space.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const isNewSessionActive = isActive && activeSessionId === null

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', space.id],
    queryFn: () => getSessions(space.id),
    enabled: isActive,
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => deleteSession(space.id, sessionId),
    onSuccess: (_, sessionId) => {
      if (activeSessionId === sessionId) {
        setActiveSession(space.id, null)
        clearMessages()
      }
      void queryClient.invalidateQueries({ queryKey: ['sessions', space.id] })
    },
  })

  const renameMutation = useMutation({
    mutationFn: (name: string) => renameSpace(space.id, name),
    onSuccess: (updated) => {
      updateSpace(updated.id, updated.name)
      setRenaming(false)
      setMenuOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: () => {
      removeSpace(space.id)
      setConfirmDelete(false)
      setMenuOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
  })

  const submitRename = () => {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === space.name) {
      setRenaming(false)
      setRenameValue(space.name)
      return
    }
    renameMutation.mutate(trimmed)
  }

  if (renaming) {
    return (
      <div className="rounded-lg border border-[#2a2a35] bg-[#171722] px-2 py-1.5">
        <input
          autoFocus
          value={renameValue}
          onChange={(event) => setRenameValue(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              submitRename()
            }
            if (event.key === 'Escape') {
              setRenaming(false)
              setRenameValue(space.name)
            }
          }}
          className="w-full rounded-md border border-[#2a2a35] bg-[#111118] px-2 py-1 text-xs text-[#f4f4f5] outline-none focus:border-[#7c5cff]"
        />
        <div className="mt-1.5 flex justify-end gap-1">
          <button
            type="button"
            onClick={() => {
              setRenaming(false)
              setRenameValue(space.name)
            }}
            className="rounded p-1 text-[#71717a] hover:text-[#e4e4e7]"
          >
            <X size={12} />
          </button>
          <button
            type="button"
            onClick={submitRename}
            className="rounded p-1 text-[#7c5cff] hover:text-[#9b84ff]"
          >
            <Check size={12} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div
        className={`group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors ${
          isActive
            ? 'border-l-2 border-indigo-500 bg-[#1a1a1a] pl-[6px]'
            : 'border-l-2 border-transparent hover:bg-[#171722]'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="ml-3 truncate text-base text-[#e4e4e7]">{space.name}</span>
        </button>

        {confirmDelete ? (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-[#a1a1aa]">Delete?</span>
            <button
              type="button"
              onClick={() => deleteMutation.mutate()}
              className="rounded px-1.5 py-0.5 text-red-400 hover:bg-[#111118]"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded px-1.5 py-0.5 text-[#a1a1aa] hover:bg-[#111118]"
            >
              No
            </button>
          </div>
        ) : (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="rounded p-1 text-[#71717a] opacity-0 transition-opacity group-hover:opacity-100 hover:bg-[#111118] hover:text-[#e4e4e7]"
              aria-label="Subject actions"
            >
              <MoreHorizontal size={14} />
            </button>
            {menuOpen ? (
              <div className="absolute top-6 right-0 z-30 min-w-[100px] rounded-lg border border-[#2a2a35] bg-[#171722] p-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(true)
                    setRenameValue(space.name)
                    setMenuOpen(false)
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-[#e4e4e7] hover:bg-[#111118]"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(true)
                    setMenuOpen(false)
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-red-400 hover:bg-[#111118]"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {isActive ? (
        <div className="ml-3 space-y-1">
          {sessions.map((session) => {
            const isSessionActive = activeSessionId === session.id
            return (
              <div
                key={session.id}
                onMouseEnter={() => setHoveredSessionId(session.id)}
                onMouseLeave={() => setHoveredSessionId((current) => (current === session.id ? null : current))}
                className={`group/session flex items-center gap-1 rounded-md border-l-2 px-2 py-1 ${
                  isSessionActive
                    ? 'border-indigo-500 bg-[#202033]'
                    : 'border-transparent hover:bg-[#171722]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveSession(space.id, session.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <Clock3 size={12} className="shrink-0 text-[#71717a]" />
                  <span className="truncate text-sm text-[#c7c7d1]">{session.title}</span>
                </button>
                {hoveredSessionId === session.id ? (
                  <button
                    type="button"
                    onClick={() => deleteSessionMutation.mutate(session.id)}
                    className="rounded p-1 text-[#71717a] hover:bg-[#111118] hover:text-red-400"
                    aria-label="Delete session"
                  >
                    <Trash2 size={12} />
                  </button>
                ) : null}
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => {
              setActiveSession(space.id, null)
              clearMessages()
            }}
            className={`w-full rounded-md border px-2 py-1 text-left text-xs transition-colors ${
              isNewSessionActive
                ? 'border-indigo-500/60 bg-[#202033] text-[#d6d6e2]'
                : 'border-transparent text-[#8a8a96] hover:bg-[#171722] hover:text-[#c7c7d1]'
            }`}
          >
            + New Session
          </button>
        </div>
      ) : null}
    </div>
  )
}

interface StudySpacesSectionProps {
  showCreateInput?: boolean
  onShowCreateInput?: () => void
  onHideCreateInput?: () => void
}

export default function StudySpacesSection({
  showCreateInput = false,
  onShowCreateInput,
  onHideCreateInput,
}: StudySpacesSectionProps) {
  const queryClient = useQueryClient()
  const { activeSpaceId, setActiveSpace, addSpace } = useSpaceStore()
  const [newSpaceName, setNewSpaceName] = useState('')

  const closeCreate = () => {
    setNewSpaceName('')
    onHideCreateInput?.()
  }

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces'],
    queryFn: getSpaces,
  })

  const createMutation = useMutation({
    mutationFn: createSpace,
    onSuccess: (space) => {
      addSpace(space)
      setActiveSpace(space.id)
      closeCreate()
      void queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
  })

  const handleCreate = () => {
    const trimmed = newSpaceName.trim()
    if (!trimmed) {
      return
    }
    createMutation.mutate(trimmed)
  }

  const handleCreateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleCreate()
    }
    if (event.key === 'Escape') {
      closeCreate()
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold tracking-wide text-[#71717a] uppercase">
        Subjects
      </p>

      <div className="space-y-0.5">
        {spaces.map((space) => (
          <SpaceRow
            key={space.id}
            space={space}
            isActive={activeSpaceId === space.id}
            onSelect={() => setActiveSpace(space.id)}
          />
        ))}

        {showCreateInput ? (
          <div className="rounded-lg border border-[#2a2a35] bg-[#171722] px-2 py-1.5">
            <input
              autoFocus
              value={newSpaceName}
              onChange={(event) => setNewSpaceName(event.target.value)}
              onKeyDown={handleCreateKeyDown}
              placeholder="Subject name..."
              className="w-full rounded-md border border-[#2a2a35] bg-[#111118] px-2 py-1 text-xs text-[#f4f4f5] outline-none focus:border-[#7c5cff]"
            />
            <div className="mt-1.5 flex justify-end gap-1">
              <button
                type="button"
                onClick={closeCreate}
                className="rounded p-1 text-[#71717a] hover:text-[#e4e4e7]"
              >
                <X size={12} />
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newSpaceName.trim() || createMutation.isPending}
                className="rounded p-1 text-[#7c5cff] hover:text-[#9b84ff] disabled:opacity-40"
              >
                <Check size={12} />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onShowCreateInput?.()}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[#a1a1aa] transition-colors hover:bg-[#171722] hover:text-[#e4e4e7]"
      >
        <Plus size={14} />
        New Subject
      </button>
    </div>
  )
}
