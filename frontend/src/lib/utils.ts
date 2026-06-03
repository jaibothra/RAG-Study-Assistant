export const formatSize = (size: number): string => {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`
}

export const getFileExtension = (filename: string): string => {
  const index = filename.lastIndexOf('.')
  return index >= 0 ? filename.slice(index).toLowerCase() : ''
}

export const getFileEmoji = (filename: string): string => {
  const ext = getFileExtension(filename)
  if (ext === '.pdf') return '📄'
  if (ext === '.docx') return '📝'
  if (ext === '.csv' || ext === '.xlsx') return '📊'
  return '📄'
}

export const streamText = (
  fullText: string,
  onUpdate: (value: string) => void,
  onDone: () => void,
): (() => void) => {
  let index = 0
  const chunkSize = Math.max(2, Math.floor(fullText.length / 80))
  const interval = window.setInterval(() => {
    index = Math.min(fullText.length, index + chunkSize)
    onUpdate(fullText.slice(0, index))
    if (index >= fullText.length) {
      window.clearInterval(interval)
      onDone()
    }
  }, 18)
  return () => window.clearInterval(interval)
}
