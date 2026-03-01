import React, { useState } from 'react'
import type { Language } from '../../../shared/types'
import { getRendererTexts } from '../i18n'

const COVER_MEDIA_EXT_RE = /\.(jpg|jpeg|png|webp|bmp|gif)$/i

interface CoverPickerProps {
  coverPath: string | null
  onSelect: (path: string) => void
  onClear: () => void
  disabled?: boolean
  language: Language
}

export function CoverPicker({ coverPath, onSelect, onClear, disabled, language }: CoverPickerProps): React.ReactElement {
  const [dragOver, setDragOver] = useState(false)
  const t = getRendererTexts(language)
  const [emptyLine1, emptyLine2 = ''] = t.coverPicker.emptyText.split('\n')

  const handleClick = async (): Promise<void> => {
    const path = await window.electronAPI.openImageFile(language)
    if (path) onSelect(path)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (): void => setDragOver(false)

  const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const imgFile = files.find(f => COVER_MEDIA_EXT_RE.test(f.name))
    if (imgFile) onSelect(window.electronAPI.getPathForFile(imgFile))
  }

  const fileName = coverPath ? coverPath.split(/[/\\]/).pop() : null
  // Use custom local-file:// protocol to bypass CORS when renderer runs on http://localhost (dev mode).
  // In production (file:// origin) this also works since the protocol handler is always registered.
  const imgSrc = coverPath ? `local-file:///${coverPath.replace(/\\/g, '/')}` : null

  return (
    <div className="cover-panel">
      <div className="cover-panel-header">
        <div className="panel-label">{t.coverPicker.panelLabel}</div>
        <button
          className="btn btn-icon"
          onClick={handleClick}
          disabled={disabled}
          title={t.coverPicker.chooseCoverTitle}
          style={{ fontSize: 18, fontWeight: 400 }}
        >
          +
        </button>
      </div>

      <div
        className={`cover-drop-zone${dragOver ? ' drag-over' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {coverPath ? (
          <>
            <img
              src={imgSrc ?? undefined}
              alt={t.coverPicker.altCover}
              draggable={false}
            />
            <div className="cover-overlay">
              <span style={{ fontSize: 22 }}>🖼️</span>
              <span className="cover-overlay-text">{t.coverPicker.replace}</span>
            </div>
          </>
        ) : (
          <div className="cover-placeholder">
            <span className="cover-placeholder-icon">🖼️</span>
            <span className="cover-placeholder-text">
              {emptyLine1}<br />{emptyLine2}
            </span>
          </div>
        )}
      </div>

      <div className="cover-formats">{t.coverPicker.supportedFormats}</div>

      <div className="cover-panel-footer">
        {coverPath ? (
          <>
            <span className="cover-name" title={coverPath}>{fileName}</span>
            <button className="btn-clear" onClick={onClear} disabled={disabled}>
              {t.coverPicker.clear}
            </button>
          </>
        ) : (
          <span className="cover-name" />
        )}
      </div>
    </div>
  )
}
