import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // File dialogs
  openAudioFiles: () => ipcRenderer.invoke('dialog:openAudioFiles'),
  openImageFile: () => ipcRenderer.invoke('dialog:openImageFile'),
  saveOutputFile: (defaultName) => ipcRenderer.invoke('dialog:saveOutputFile', defaultName),
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  openFolder: (folderPath) => ipcRenderer.send('dialog:openFolder', folderPath),

  // File path resolution (Electron 29+: File.path is removed, use webUtils)
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // FFmpeg
  getAudioDuration: (filePath) => ipcRenderer.invoke('ffmpeg:getDuration', filePath),
  startProcessing: (config) => ipcRenderer.send('ffmpeg:process', config),
  cancelProcessing: () => ipcRenderer.send('ffmpeg:cancel'),

  // Events from main process
  onProgress: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('ffmpeg:progress', handler)
    return () => ipcRenderer.removeListener('ffmpeg:progress', handler)
  },
  onComplete: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('ffmpeg:complete', handler)
    return () => ipcRenderer.removeListener('ffmpeg:complete', handler)
  },
  onCancelled: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('ffmpeg:cancelled', handler)
    return () => ipcRenderer.removeListener('ffmpeg:cancelled', handler)
  },
  onError: (callback) => {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('ffmpeg:error', handler)
    return () => ipcRenderer.removeListener('ffmpeg:error', handler)
  }
})
