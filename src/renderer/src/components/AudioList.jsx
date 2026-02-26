import React, { useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove
} from '@dnd-kit/sortable'
import { AudioItem } from './AudioItem.jsx'

const AUDIO_EXTS = /\.(mp3|wav|flac|m4a|ogg|aac)$/i

function formatTotalDuration(files) {
  const total = files.reduce((acc, f) => acc + (f.duration || 0), 0)
  if (total === 0) return null
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = Math.floor(total % 60)
  if (h > 0) return `${h} ч ${m} мин`
  if (m > 0) return `${m} мин ${s} сек`
  return `${s} сек`
}

export function AudioList({ files, onFilesChange, onAdd, onDropFiles, disabled }) {
  const [osDragOver, setOsDragOver] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = files.findIndex(f => f.id === active.id)
      const newIndex = files.findIndex(f => f.id === over.id)
      onFilesChange(arrayMove(files, oldIndex, newIndex))
    }
  }

  const handleRemove = (id) => {
    onFilesChange(files.filter(f => f.id !== id))
  }

  // Handle OS file drag-and-drop
  const handleOsDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setOsDragOver(true)
  }, [])

  const handleOsDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOsDragOver(false)
  }, [])

  const handleOsDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setOsDragOver(false)
    const paths = Array.from(e.dataTransfer.files)
      .filter(f => AUDIO_EXTS.test(f.name))
      .map(f => window.electronAPI.getPathForFile(f))
    if (paths.length > 0 && onDropFiles) onDropFiles(paths)
  }, [onDropFiles])

  const duration = formatTotalDuration(files)
  const plural = (n) => n === 1 ? 'файл' : n < 5 ? 'файла' : 'файлов'

  return (
    <div className="audio-panel">
      <div className="audio-panel-header">
        <div className="panel-label">Аудиофайлы</div>
        <button
          className="btn btn-icon"
          onClick={onAdd}
          disabled={disabled}
          title="Добавить файлы"
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
              Нажмите «+» или перетащите<br />MP3-файлы из проводника
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
              {files.length} {plural(files.length)}
              {duration ? ` · ${duration}` : ''}
            </span>
            <button className="btn-clear" onClick={() => onFilesChange([])} disabled={disabled}>
              Очистить
            </button>
          </>
        ) : (
          <span className="audio-stats" />
        )}
      </div>
    </div>
  )
}
