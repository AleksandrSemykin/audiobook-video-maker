import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AudioFile } from '../../../shared/types'

interface AudioItemProps {
  file: AudioFile
  index: number
  onRemove: (id: string) => void
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds)) return '--:--'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function AudioItem({ file, index, onRemove }: AudioItemProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: file.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`audio-item${isDragging ? ' is-dragging' : ''}`}
    >
      {/* Drag handle */}
      <span
        className="audio-drag-handle"
        {...attributes}
        {...listeners}
        title="Перетащите для изменения порядка"
      >
        ⠿
      </span>

      {/* Index */}
      <span className="audio-index">{index + 1}.</span>

      {/* Icon */}
      <span className="audio-icon">🎵</span>

      {/* Info */}
      <div className="audio-info">
        <div className="audio-name" title={file.path}>{file.name}</div>
        <div className="audio-meta">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
      </div>

      {/* Duration */}
      <span className="audio-duration">{formatDuration(file.duration)}</span>

      {/* Remove button */}
      <button
        className="audio-remove-btn"
        onClick={() => onRemove(file.id)}
        title="Удалить"
      >
        ×
      </button>
    </div>
  )
}
