import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { AppUpdateData, ElectronAPI, Language, ProcessConfig, ProgressData } from '../shared/types'

const api: ElectronAPI = {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  setLanguage: (language) => ipcRenderer.send('app:setLanguage', language),

  // File dialogs
  openAudioFiles: (language) => ipcRenderer.invoke('dialog:openAudioFiles', language),
  openImageFile: (language) => ipcRenderer.invoke('dialog:openImageFile', language),
  saveOutputFile: (defaultName?: string, language?: Language) =>
    ipcRenderer.invoke('dialog:saveOutputFile', defaultName, language),
  selectFolder: (language) => ipcRenderer.invoke('dialog:selectFolder', language),
  openFolder: (folderPath: string) => ipcRenderer.send('dialog:openFolder', folderPath),

  // File path resolution (Electron 29+: File.path is removed, use webUtils)
  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  // FFmpeg
  getAudioDuration: (filePath: string) => ipcRenderer.invoke('ffmpeg:getDuration', filePath),
  startProcessing: (config: ProcessConfig) => ipcRenderer.send('ffmpeg:process', config),
  cancelProcessing: () => ipcRenderer.send('ffmpeg:cancel'),

  // Events from main process
  onProgress: (callback: (data: ProgressData) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ProgressData) => callback(data)
    ipcRenderer.on('ffmpeg:progress', handler)
    return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
  },
  onComplete: (callback: (data: { outputPath: string; totalTime: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { outputPath: string; totalTime: string }) => callback(data)
    ipcRenderer.on('ffmpeg:complete', handler)
    return () => ipcRenderer.removeListener('ffmpeg:complete', handler)
  },
  onCancelled: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('ffmpeg:cancelled', handler)
    return () => ipcRenderer.removeListener('ffmpeg:cancelled', handler)
  },
  onError: (callback: (data: { message: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { message: string }) => callback(data)
    ipcRenderer.on('ffmpeg:error', handler)
    return () => ipcRenderer.removeListener('ffmpeg:error', handler)
  },
  onAppUpdate: (callback: (data: AppUpdateData) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: AppUpdateData) => callback(data)
    ipcRenderer.on('app:update', handler)
    return () => ipcRenderer.removeListener('app:update', handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
