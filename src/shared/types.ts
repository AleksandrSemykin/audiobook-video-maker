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

export interface AppSettings {
  quality: Quality
  transitions: Transition
  showChapterTitles: boolean
}

// Config sent from renderer → main via IPC to start ffmpeg processing
export interface ProcessConfig {
  coverImage: string
  audioFiles: Array<{ path: string; name: string }>
  outputPath: string
  quality: Quality
  showChapterTitles: boolean
  transitions: Transition
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
  isProcessing?: boolean
  /** Human-readable encoder label, e.g. 'NVIDIA GPU', 'Intel Quick Sync', 'AMD GPU', 'CPU' */
  encoderLabel?: string
  /** Raw ffmpeg encoder id, e.g. 'h264_nvenc' */
  encoderId?: string
}

// Electron API exposed via contextBridge (available as window.electronAPI)
export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void

  // File dialogs
  openAudioFiles: () => Promise<string[]>
  openImageFile: () => Promise<string | null>
  saveOutputFile: (defaultName?: string) => Promise<string | null>
  selectFolder: () => Promise<string | null>
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
}
