import React, { useState, useEffect, useCallback, useRef } from 'react'
import { CoverPicker } from './components/CoverPicker'
import { AudioList } from './components/AudioList'
import { Settings } from './components/Settings'
import { ProgressBar } from './components/ProgressBar'
import { ToastContainer, useToast } from './components/Toast'
import type { AudioFile, AppSettings, ProgressData } from '../../shared/types'

// Auto-detect order number from filename
function getFileOrder(name: string): number {
  const m = name.match(/^(\d+)[.\s_\-]?/)
  return m ? parseInt(m[1], 10) : 999
}

let fileIdCounter = 0

function createFileEntry(path: string): AudioFile {
  const name = path.split(/[/\\]/).pop() ?? path
  const base = name.replace(/\.(mp3|wav|flac|m4a|ogg|aac)$/i, '')
  return {
    id: String(++fileIdCounter),
    path,
    name: base,
    fullName: name,
    size: 0,
    duration: null
  }
}

export default function App(): React.ReactElement {
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [settings, setSettings] = useState<AppSettings>({
    quality: '1080p',
    transitions: 'none',
    showChapterTitles: false
  })
  const [videoName, setVideoName] = useState<string>('')
  const [outputFolder, setOutputFolder] = useState<string>('')
  // Computed full output path — derived from folder + name
  const outputPath = outputFolder && videoName.trim()
    ? `${outputFolder}\\${videoName.trim()}.mp4`
    : ''
  // Ref so stable addAudioPaths callback can read current videoName
  const videoNameRef = useRef(videoName)
  videoNameRef.current = videoName
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<ProgressData & { isProcessing: boolean }>({
    percent: 0,
    stage: '',
    isProcessing: false
  })
  const [lastOutput, setLastOutput] = useState<string | null>(null)

  const { toasts, addToast, removeToast } = useToast()

  // Listen to FFmpeg events
  useEffect(() => {
    const unsubProgress = window.electronAPI.onProgress((data) => {
      setProgress({ ...data, isProcessing: true })
    })

    const unsubComplete = window.electronAPI.onComplete(({ outputPath: out }) => {
      setIsProcessing(false)
      setLastOutput(out)
      setProgress({ percent: 100, stage: 'Готово! 🎉', isProcessing: false })
      addToast(`Видео сохранено: ${out.split(/[/\\]/).pop()}`, 'success', 6000)
    })

    const unsubCancelled = window.electronAPI.onCancelled(() => {
      setIsProcessing(false)
      setProgress({ percent: 0, stage: '', isProcessing: false })
      addToast('Создание видео отменено', 'warning')
    })

    const unsubError = window.electronAPI.onError(({ message }) => {
      setIsProcessing(false)
      setProgress({ percent: 0, stage: '', isProcessing: false })
      addToast(`Ошибка FFmpeg: ${message}`, 'error', 8000)
      console.error('FFmpeg error:', message)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubCancelled()
      unsubError()
    }
  }, [])

  // Add audio files (shared logic for both dialog and OS drop)
  const addAudioPaths = useCallback((paths: string[]) => {
    if (!paths?.length) return
    const newEntries = paths.map(createFileEntry)
    setAudioFiles(prev => {
      const combined = [...prev, ...newEntries]
      combined.sort((a, b) => getFileOrder(a.fullName) - getFileOrder(b.fullName))
      return combined
    })
    // Auto-fill video name from first file if not yet set by user
    if (!videoNameRef.current && newEntries[0]) {
      const auto = newEntries[0].name.replace(/^\d+[.\s_\-]*/, '').trim() || 'audiobook'
      setVideoName(auto)
    }
    // Load duration and size via ffprobe in background
    for (const entry of newEntries) {
      window.electronAPI.getAudioDuration(entry.path).then(({ duration, size }) => {
        setAudioFiles(prev => prev.map(f => f.id === entry.id ? { ...f, duration, size } : f))
      }).catch(() => {})
    }
  }, [])

  const handleAddFiles = useCallback(async () => {
    const paths = await window.electronAPI.openAudioFiles()
    if (paths?.length) addAudioPaths(paths)
  }, [addAudioPaths])

  // Select output folder
  const handleSelectFolder = async (): Promise<void> => {
    const folder = await window.electronAPI.selectFolder()
    if (folder) setOutputFolder(folder)
  }

  // Start processing
  const handleStart = (): void => {
    if (!coverPath) {
      addToast('Выберите обложку для видео', 'warning')
      return
    }
    if (audioFiles.length === 0) {
      addToast('Добавьте хотя бы один аудиофайл', 'warning')
      return
    }
    if (!outputPath) {
      addToast('Укажите путь для сохранения видео', 'warning')
      return
    }

    setIsProcessing(true)
    setLastOutput(null)
    setProgress({ percent: 0, stage: 'Инициализация...', isProcessing: true })

    window.electronAPI.startProcessing({
      coverImage: coverPath,
      audioFiles: audioFiles.map(f => ({ path: f.path, name: f.name })),
      outputPath,
      quality: settings.quality,
      showChapterTitles: settings.showChapterTitles,
      transitions: settings.transitions
    })
  }

  const handleCancel = (): void => {
    window.electronAPI.cancelProcessing()
  }

  const handleOpenFolder = (): void => {
    if (lastOutput) {
      const folder = lastOutput.split(/[/\\]/).slice(0, -1).join('\\') || lastOutput
      window.electronAPI.openFolder(folder)
    }
  }

  const canStart = coverPath && audioFiles.length > 0 && outputPath && !isProcessing

  return (
    <div className="app">
      {/* Titlebar */}
      <div className="titlebar">
        <div className="titlebar-left">
          <span className="titlebar-icon">🎵</span>
          <span className="titlebar-title">AudioBook Video Maker</span>
        </div>
        <div className="titlebar-controls">
          <button className="titlebar-btn" onClick={() => window.electronAPI.minimizeWindow()}>─</button>
          <button className="titlebar-btn" onClick={() => window.electronAPI.maximizeWindow()}>□</button>
          <button className="titlebar-btn close" onClick={() => window.electronAPI.closeWindow()}>✕</button>
        </div>
      </div>

      {/* Main content */}
      <div className="main-content">
        {/* Top: Cover + Audio */}
        <div className="top-panel">
          <CoverPicker
            coverPath={coverPath}
            onSelect={setCoverPath}
            onClear={() => setCoverPath(null)}
            disabled={isProcessing}
          />

          <div className="divider" />

          <AudioList
            files={audioFiles}
            onFilesChange={setAudioFiles}
            onAdd={handleAddFiles}
            onDropFiles={addAudioPaths}
            disabled={isProcessing}
          />
        </div>

        {/* Settings */}
        <Settings
          settings={settings}
          onChange={setSettings}
          videoName={videoName}
          onVideoNameChange={setVideoName}
          outputFolder={outputFolder}
          onSelectFolder={handleSelectFolder}
          outputPath={outputPath}
          disabled={isProcessing}
        />

        {/* Bottom bar */}
        <div className="bottom-bar">
          {/* Progress / Success banner */}
          {lastOutput && !isProcessing ? (
            <div className="success-banner">
              <span>✅</span>
              <span>Видео создано:</span>
              <span className="success-banner-path" title={lastOutput}>
                {lastOutput}
              </span>
              <button
                className="btn btn-secondary"
                onClick={handleOpenFolder}
                style={{ padding: '5px 12px', fontSize: 12 }}
              >
                📂 Открыть
              </button>
            </div>
          ) : (
            <ProgressBar
              progress={progress}
              onCancel={handleCancel}
              onOpenFolder={handleOpenFolder}
              outputPath={lastOutput}
            />
          )}

          {/* Action buttons */}
          {isProcessing ? (
            <button className="btn btn-danger" onClick={handleCancel}>
              ⏹ Отмена
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!canStart}
              title={!coverPath ? 'Выберите обложку' : !audioFiles.length ? 'Добавьте аудиофайлы' : !outputPath ? 'Выберите путь сохранения' : ''}
            >
              ▶ Создать видео
            </button>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
