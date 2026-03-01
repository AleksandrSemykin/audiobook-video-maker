import React, { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { AudioItem } from './AudioItem'
import type { AudioFile, Language } from '../../../shared/types'
import { formatAudioDuration, getRendererTexts } from '../i18n'

interface AudioListProps {
  files: AudioFile[]
  onFilesChange: (files: AudioFile[]) => void
  onAdd: () => void
  onDropFiles: (paths: string[]) => void
  disabled?: boolean
  language: Language
}

const AUDIO_EXTS = /\.(mp3|wav|flac|m4a|ogg|aac)$/i

function formatTotalDuration(files: AudioFile[], language: Language): string | null {
  const total = files.reduce((acc, f) => acc + (f.duration ?? 0), 0)
  return formatAudioDuration(total, language)
}

export function AudioList({ files, onFilesChange, onAdd, onDropFiles, disabled, language }: AudioListProps): React.ReactElement {
  const [osDragOver, setOsDragOver] = useState(false)
  const t = getRendererTexts(language)
  const [emptyLine1, emptyLine2 = ''] = t.audioList.emptyText.split('\n')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex(f => f.id === active.id)
      const newIndex = files.findIndex(f => f.id === over.id)
      onFilesChange(arrayMove(files, oldIndex, newIndex))
    }
  }

  const handleRemove = (id: string): void => {
    onFilesChange(files.filter(f => f.id !== id))
  }

  // Handle OS file drag-and-drop
  const handleOsDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setOsDragOver(true)
  }, [])

  const handleOsDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setOsDragOver(false)
  }, [])

  const handleOsDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setOsDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => AUDIO_EXTS.test(f.name))
      .map(f => window.electronAPI.getPathForFile(f))
    if (paths.length > 0 && onDropFiles) onDropFiles(paths)
  }, [onDropFiles])

  const duration = formatTotalDuration(files, language)

  return (
    <div className="audio-panel">
      <div className="audio-panel-header">
        <div className="panel-label">{t.audioList.panelLabel}</div>
        <button
          className="btn btn-icon"
          onClick={onAdd}
          disabled={disabled}
          title={t.audioList.addFilesTitle}
          style={{ fontSize: 18, fontWeight: 400 }}
        >
          +
        </button>
      </div>

      <div
        className="audio-list-wrapper"
        onDragOver={handleOsDragOver}
        onDragLeave={handleOsDragLeave}
        onDrop={handleOsDrop}
        style={osDragOver
          ? { borderColor: 'var(--primary)', background: 'rgba(124,106,247,0.07)' }
          : {}}
      >
        {files.length === 0 ? (
          <div className="audio-list-empty">
            <span className="audio-list-empty-icon">🎙️</span>
            <span className="audio-list-empty-text">
              {emptyLine1}<br />{emptyLine2}
            </span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={files.map(f => f.id)} strategy={verticalListSortingStrategy}>
              <div className="audio-list">
                {files.map((file, index) => (
                  <AudioItem
                    key={file.id}
                    file={file}
                    index={index}
                    onRemove={handleRemove}
                    language={language}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="audio-list-footer">
        {files.length > 0 ? (
          <>
            <span className="audio-stats">
              {t.audioList.filesCount(files.length)}
              {duration ? ` · ${duration}` : ''}
            </span>
            <button className="btn-clear" onClick={() => onFilesChange([])} disabled={disabled}>
              {t.audioList.clear}
            </button>
          </>
        ) : (
          <span className="audio-stats" />
        )}
      </div>
    </div>
  )
}
