import { useEffect, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, UploadCloud } from 'lucide-react'
import { uploadToSpace } from '../api/spaces'

type UploadStatus = 'uploading' | 'success' | 'error'

interface UploadItem {
  name: string
  status: UploadStatus
}

interface FileUploadProps {
  spaceId: string
}

export default function FileUpload({ spaceId }: FileUploadProps) {
  const queryClient = useQueryClient()
  const [uploads, setUploads] = useState<UploadItem[]>([])

  useEffect(() => {
    setUploads([])
  }, [spaceId])

  const mutation = useMutation({
    mutationFn: (files: File[]) => uploadToSpace(spaceId, files),
    onSuccess: (response) => {
      setUploads((prev) =>
        prev.map((item) =>
          response.uploaded.includes(item.name) ? { ...item, status: 'success' } : item,
        ),
      )
      void queryClient.invalidateQueries({ queryKey: ['documents', spaceId] })
      void queryClient.invalidateQueries({ queryKey: ['spaces'] })
    },
    onError: () => {
      setUploads((prev) => prev.map((item) => ({ ...item, status: 'error' })))
    },
  })

  const onDrop = (files: File[]) => {
    if (!files.length) {
      return
    }
    setUploads(files.map((file) => ({ name: file.name, status: 'uploading' })))
    mutation.mutate(files)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'text/plain': ['.txt'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
  })

  const borderClass = useMemo(
    () =>
      isDragActive
        ? 'border-[#7c5cff] bg-[#171722]'
        : 'border-[#2a2a35] border-dashed hover:border-[#7c5cff55] hover:bg-[#1b1b27]',
    [isDragActive],
  )

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border px-3 py-3 transition-all duration-200 ${borderClass}`}
      >
        <input {...getInputProps()} />
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-[#111118] p-1.5">
            <UploadCloud size={16} className="text-[#7c5cff]" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-xs font-medium text-[#e4e4e7]">Upload Notes</p>
            <p className="truncate text-[11px] text-[#71717a]">
              PDF, DOCX, TXT, CSV, XLSX · drag or click
            </p>
          </div>
        </div>
      </div>

      {uploads.length > 0 ? (
        <div className="space-y-1.5">
          {uploads.map((upload) => (
            <div
              key={upload.name}
              className="rounded-lg border border-[#2a2a35] bg-[#171722] px-2.5 py-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-[#e4e4e7]">{upload.name}</span>
                {upload.status === 'success' ? (
                  <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                ) : null}
                {upload.status === 'error' ? (
                  <span className="text-[11px] text-red-400">Failed</span>
                ) : null}
              </div>
              {upload.status === 'uploading' ? (
                <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-[#111118]">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-[#7c5cff]" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
