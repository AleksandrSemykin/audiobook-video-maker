import React, { useState } from 'react'

export function CoverPicker({ coverPath, onSelect, onClear, disabled }) {
  const [dragOver, setDragOver] = useState(false)

  const handleClick = async () => {
    const path = await window.electronAPI.openImageFile()
    if (path) onSelect(path)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    const imgFile = files.find(f => /\.(jpg|jpeg|png|webp|bmp)$/i.test(f.name))
    if (imgFile) onSelect(window.electronAPI.getPathForFile(imgFile))
  }

  const fileName = coverPath ? coverPath.split(/[/\\]/).pop() : null
  // Use custom local-file:// protocol to bypass CORS when renderer runs on http://localhost (dev mode).
  // In production (file:// origin) this also works since the protocol handler is always registered.
  const imgSrc = coverPath ? `local-file:///${coverPath.replace(/\\/g, '/')}` : null

  return (
    <div className="cover-panel">
      <div className="cover-panel-header">
        <div className="panel-label">Обложка</div>
        <button
          className="btn btn-icon"
          onClick={handleClick}
          disabled={disabled}
          title="Выбрать обложку"
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
              src={imgSrc}
              alt="Cover"
              draggable={false}
            />
            <div className="cover-overlay">
              <span style={{ fontSize: 22 }}>🖼️</span>
              <span className="cover-overlay-text">Заменить</span>
            </div>
          </>
        ) : (
          <div className="cover-placeholder">
            <span className="cover-placeholder-icon">🖼️</span>
            <span className="cover-placeholder-text">
              Перетащите обложку<br />или нажмите для выбора
            </span>
          </div>
        )}
      </div>

      <div className="cover-panel-footer">
        {coverPath ? (
          <>
            <span className="cover-name" title={coverPath}>{fileName}</span>
            <button className="btn-clear" onClick={onClear} disabled={disabled}>
              Очистить
            </button>
          </>
        ) : (
          <span className="cover-name" />
        )}
      </div>
    </div>
  )
}
