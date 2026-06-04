import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MoreHorizontal, Plus, X } from 'lucide-react'
import { createSpace, deleteSpace, getSpaces, renameSpace } from '../api/spaces'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(space.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

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
        <span className="truncate text-sm text-[#e4e4e7]">{space.name}</span>
        <span className="ml-auto shrink-0 rounded-full bg-[#111118] px-1.5 py-0.5 text-[10px] text-[#a1a1aa]">
          {space.document_count}
        </span>
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
            aria-label="Space actions"
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
        Spaces
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
              placeholder="Space name..."
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
        New Space
      </button>
    </div>
  )
}
