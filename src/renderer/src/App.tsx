import React, { useState, useEffect, useCallback, useRef } from 'react'
import twemoji from 'twemoji'
import { CoverPicker } from './components/CoverPicker'
import { AudioList } from './components/AudioList'
import { Settings } from './components/Settings'
import { ProgressBar } from './components/ProgressBar'
import { ToastContainer, useToast } from './components/Toast'
import type { AppUpdateData, AudioFile, AppSettings, ProgressData } from '../../shared/types'
import { getRendererTexts } from './i18n'

// Auto-detect order number from filename
function getFileOrder(name: string): number {
  const m = name.match(/^(\d+)[.\s_\-]?/)
  return m ? parseInt(m[1], 10) : 999
}

let fileIdCounter = 0
const LANGUAGE_STORAGE_KEY = 'abvm.language'
const TWEMOJI_CDN_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg'

function getLanguageFlagSvg(language: AppSettings['language']): string {
  const emoji = language === 'ru' ? '\u{1F1F7}\u{1F1FA}' : '\u{1F1FA}\u{1F1F8}'
  const codepoint = twemoji.convert.toCodePoint(emoji)
  return `${TWEMOJI_CDN_BASE}/${codepoint}.svg`
}

function readSavedLanguage(): AppSettings['language'] {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'ru' || saved === 'en') return saved
  } catch {
    // ignore storage access errors
  }
  return 'ru'
}

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
  const [settings, setSettings] = useState<AppSettings>(() => ({
    quality: '1080p',
    encodingMode: 'min_size',
    transitions: 'none',
    showChapterTitles: false,
    language: readSavedLanguage()
  }))
  const [videoName, setVideoName] = useState<string>('')
  const [outputFolder, setOutputFolder] = useState<string>('')
  // Computed full output path — derived from folder + name
  const outputPath = outputFolder && videoName.trim()
    ? `${outputFolder}\\${videoName.trim()}.mp4`
    : ''
  // Ref so stable addAudioPaths callback can read current videoName
  const videoNameRef = useRef(videoName)
  videoNameRef.current = videoName
  const languageRef = useRef(settings.language)
  languageRef.current = settings.language
  const updateProgressMilestoneRef = useRef(0)
  // Gate for stale ffmpeg:progress events that arrive after ffmpeg:complete/cancelled/error.
  // Set to true as soon as the conversion is finished; reset on next start.
  const isDoneRef = useRef(false)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [progress, setProgress] = useState<ProgressData & { isProcessing: boolean }>({
    percent: 0,
    stage: '',
    isProcessing: false
  })
  const [lastOutput, setLastOutput] = useState<string | null>(null)
  const [lastTotalTime, setLastTotalTime] = useState<string | null>(null)
  const t = getRendererTexts(settings.language)

  const { toasts, addToast, removeToast } = useToast()

  useEffect(() => {
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, settings.language)
    } catch {
      // ignore storage access errors
    }
  }, [settings.language])

  useEffect(() => {
    window.electronAPI.setLanguage(settings.language)
  }, [settings.language])

  // Listen to FFmpeg events
  useEffect(() => {
    const unsubProgress = window.electronAPI.onProgress((data) => {
      if (isDoneRef.current) return
      setProgress({ ...data, isProcessing: true })
    })

    const unsubComplete = window.electronAPI.onComplete(({ outputPath: out, totalTime }) => {
      const locale = getRendererTexts(languageRef.current)
      isDoneRef.current = true
      setIsProcessing(false)
      setLastOutput(out)
      setLastTotalTime(totalTime)
      setProgress({ percent: 100, stage: locale.app.doneStage, isProcessing: false })
      addToast(locale.app.videoSaved(out.split(/[/\\]/).pop() ?? out), 'success', 6000)
    })

    const unsubCancelled = window.electronAPI.onCancelled(() => {
      const locale = getRendererTexts(languageRef.current)
      isDoneRef.current = true
      setIsProcessing(false)
      setProgress({ percent: 0, stage: '', isProcessing: false })
      addToast(locale.app.cancelled, 'warning')
    })

    const unsubError = window.electronAPI.onError(({ message }) => {
      const locale = getRendererTexts(languageRef.current)
      isDoneRef.current = true
      setIsProcessing(false)
      setProgress({ percent: 0, stage: '', isProcessing: false })
      addToast(`${locale.app.ffmpegErrorPrefix}: ${message}`, 'error', 8000)
      console.error('FFmpeg error:', message)
    })

    return () => {
      unsubProgress()
      unsubComplete()
      unsubCancelled()
      unsubError()
    }
  }, [])

  // Listen to app update events
  useEffect(() => {
    const unsubAppUpdate = window.electronAPI.onAppUpdate((data: AppUpdateData) => {
      const locale = getRendererTexts(languageRef.current)
      if (data.status === 'available') {
        if (data.version) {
          updateProgressMilestoneRef.current = 0
          addToast(locale.app.updateAvailable(data.version), 'info', 5000)
        }

        if (typeof data.percent === 'number') {
          const milestone =
            data.percent >= 100 ? 100 :
              data.percent >= 75 ? 75 :
                data.percent >= 50 ? 50 :
                  data.percent >= 25 ? 25 : 0

          if (milestone > updateProgressMilestoneRef.current) {
            updateProgressMilestoneRef.current = milestone
            addToast(locale.app.updateDownloading(milestone), 'info', 2800)
          }
        }
      }

      if (data.status === 'downloaded') {
        updateProgressMilestoneRef.current = 100
        addToast(locale.app.updateDownloaded(data.version ?? ''), 'success', 6000)
      }

      if (data.status === 'error') {
        const suffix = data.message ? `: ${data.message}` : ''
        addToast(`${locale.app.updateErrorPrefix}${suffix}`, 'warning', 7000)
      }
    })

    return () => {
      unsubAppUpdate()
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
    const paths = await window.electronAPI.openAudioFiles(settings.language)
    if (paths?.length) addAudioPaths(paths)
  }, [addAudioPaths, settings.language])

  // Select output folder
  const handleSelectFolder = async (): Promise<void> => {
    const folder = await window.electronAPI.selectFolder(settings.language)
    if (folder) setOutputFolder(folder)
  }

  // Start processing
  const handleStart = (): void => {
    if (!coverPath) {
      addToast(t.app.chooseCoverWarning, 'warning')
      return
    }
    if (audioFiles.length === 0) {
      addToast(t.app.addAudioWarning, 'warning')
      return
    }
    if (!outputPath) {
      addToast(t.app.chooseOutputWarning, 'warning')
      return
    }

    setIsProcessing(true)
    setLastOutput(null)
    setLastTotalTime(null)
    isDoneRef.current = false
    setProgress({ percent: 0, stage: t.app.initStage, isProcessing: true })

    window.electronAPI.startProcessing({
      coverImage: coverPath,
      audioFiles: audioFiles.map(f => ({ path: f.path, name: f.name })),
      outputPath,
      quality: settings.quality,
      encodingMode: settings.encodingMode,
      showChapterTitles: settings.showChapterTitles,
      transitions: settings.transitions,
      language: settings.language
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

  const handleToggleLanguage = (): void => {
    if (isProcessing) return
    setSettings(prev => ({
      ...prev,
      language: prev.language === 'ru' ? 'en' : 'ru'
    }))
  }

  const canStart = coverPath && audioFiles.length > 0 && outputPath && !isProcessing
  const languageFlagSrc = getLanguageFlagSvg(settings.language)

  return (
    <div className="app">
      {/* Titlebar */}
      <div className="titlebar">
        <div className="titlebar-left">
          <span className="titlebar-icon">🎵</span>
          <span className="titlebar-title">AudioBook Video Maker</span>
        </div>
        <div className="titlebar-controls">
          <button
            className="titlebar-btn titlebar-lang-btn"
            onClick={handleToggleLanguage}
            title={t.app.switchLanguage}
            aria-label={t.app.switchLanguage}
            disabled={isProcessing}
          >
            <img
              className="titlebar-lang-emoji"
              src={languageFlagSrc}
              alt=""
              draggable={false}
              aria-hidden="true"
            />
            <span className="titlebar-lang-code">{settings.language.toUpperCase()}</span>
          </button>
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
            language={settings.language}
          />

          <div className="divider" />

          <AudioList
            files={audioFiles}
            onFilesChange={setAudioFiles}
            onAdd={handleAddFiles}
            onDropFiles={addAudioPaths}
            disabled={isProcessing}
            language={settings.language}
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
              <span>{t.app.videoCreated}</span>
              <span className="success-banner-path" title={lastOutput}>
                {lastOutput}
              </span>
              {lastTotalTime && (
                <span className="success-banner-time">⏱ {lastTotalTime}</span>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleOpenFolder}
                style={{ padding: '5px 12px', fontSize: 12 }}
              >
                {t.app.openFolder}
              </button>
            </div>
          ) : (
            <ProgressBar
              progress={progress}
              onCancel={handleCancel}
              onOpenFolder={handleOpenFolder}
              outputPath={lastOutput}
              language={settings.language}
            />
          )}

          {/* Action buttons */}
          {isProcessing ? (
            <button className="btn btn-danger" onClick={handleCancel}>
              {t.app.cancel}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleStart}
              disabled={!canStart}
              title={!coverPath ? t.app.titleChooseCover : !audioFiles.length ? t.app.titleAddAudio : !outputPath ? t.app.titleChooseOutput : ''}
            >
              {t.app.createVideo}
            </button>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  )
}
