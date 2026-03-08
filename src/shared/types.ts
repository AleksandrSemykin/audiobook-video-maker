// Audio file entry managed by the renderer
export interface AudioFile {
  id: string
  path: string
  name: string       // base name without extension (used as chapter title)
  fullName: string   // full filename with extension
  size: number       // bytes
  duration: number | null
}

// Settings
export type Quality = '1080p' | '720p' | '480p'
export type Transition = 'none' | 'fade'
export type EncodingMode = 'max_quality' | 'min_size'
export type UploadTarget = 'universal' | 'youtube_fast'
export type Language = 'ru' | 'en'

export interface AppSettings {
  quality: Quality
  encodingMode: EncodingMode
  uploadTarget: UploadTarget
  transitions: Transition
  showChapterTitles: boolean
  language: Language
}

// Config sent from renderer → main via IPC to start ffmpeg processing
export interface ProcessConfig {
  coverImage: string
  audioFiles: Array<{ path: string; name: string }>
  outputPath: string
  quality: Quality
  encodingMode: EncodingMode
  uploadTarget: UploadTarget
  showChapterTitles: boolean
  transitions: Transition
  language: Language
}

// Progress update from main → renderer
export interface ProgressData {
  percent: number
  stage: string
  totalChapters?: number
  currentChapter?: number
  elapsed?: string
  total?: string
  eta?: string
  /** True while ffmpeg is finishing muxing/writing after audio timeline is done */
  isFinalizing?: boolean
  isProcessing?: boolean
  /** Human-readable encoder label, e.g. 'NVIDIA GPU', 'Intel Quick Sync', 'AMD GPU', 'CPU' */
  encoderLabel?: string
  /** Raw ffmpeg encoder id, e.g. 'h264_nvenc' */
  encoderId?: string
}

export type AppUpdateStatus = 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'

export interface AppUpdateData {
  status: AppUpdateStatus
  version?: string
  message?: string
  percent?: number
}

// Electron API exposed via contextBridge (available as window.electronAPI)
export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  setLanguage: (language: Language) => void

  // File dialogs
  openAudioFiles: (language?: Language) => Promise<string[]>
  openImageFile: (language?: Language) => Promise<string | null>
  saveOutputFile: (defaultName?: string, language?: Language) => Promise<string | null>
  selectFolder: (language?: Language) => Promise<string | null>
  openFolder: (folderPath: string) => void

  // File path resolution
  getPathForFile: (file: File) => string

  // FFmpeg
  getAudioDuration: (filePath: string) => Promise<{ duration: number; size: number }>
  startProcessing: (config: ProcessConfig) => void
  cancelProcessing: () => void

  // Events from main process (return unsubscribe functions)
  onProgress: (callback: (data: ProgressData) => void) => () => void
  onComplete: (callback: (data: { outputPath: string; totalTime: string }) => void) => () => void
  onCancelled: (callback: () => void) => () => void
  onError: (callback: (data: { message: string }) => void) => () => void
  onAppUpdate: (callback: (data: AppUpdateData) => void) => () => void
}
