import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { setupFfmpegHandlers } from './ffmpeg.js'

// Must be called before app.whenReady() — registers custom scheme as privileged
// so it can bypass CSP and be treated as secure (same as https://)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-file',
    privileges: { secure: true, supportFetchAPI: true, bypassCSP: true, corsEnabled: false }
  }
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 900,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: join(__dirname, '../../resources/icon.png')
  })

  // Dev / Prod URL
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  // Serve local files via custom protocol (avoids CORS issues when renderer
  // runs on http://localhost in dev mode and needs to load file:// images)
  protocol.handle('local-file', (req) => {
    // req.url: "local-file:///C:/Users/..."  →  strip prefix, keep "/C:/..."
    const filePath = req.url.slice('local-file:///'.length)
    return net.fetch('file:///' + filePath)
  })

  const win = createWindow()

  // Window control handlers
  ipcMain.on('window:minimize', () => win.minimize())
  ipcMain.on('window:maximize', () => {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('window:close', () => win.close())

  // Dialog handlers
  ipcMain.handle('dialog:openAudioFiles', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Выберите аудиофайлы',
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'aac'] }],
      properties: ['openFile', 'multiSelections']
    })
    return result.canceled ? [] : result.filePaths
  })

  ipcMain.handle('dialog:openImageFile', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Выберите обложку',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }],
      properties: ['openFile']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveOutputFile', async (_, defaultName) => {
    const result = await dialog.showSaveDialog(win, {
      title: 'Сохранить видео как...',
      defaultPath: defaultName || 'audiobook.mp4',
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    })
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Выберите папку для сохранения видео',
      properties: ['openDirectory', 'createDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.on('dialog:openFolder', (_, folderPath) => {
    shell.openPath(folderPath)
  })

  // Setup FFmpeg handlers
  setupFfmpegHandlers(ipcMain, win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
