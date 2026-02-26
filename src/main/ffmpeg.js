import { app } from 'electron'
import { createRequire } from 'module'

// Use createRequire for CJS packages in ESM context
const require = createRequire(import.meta.url)
const ffmpegStatic = require('ffmpeg-static')
const ffprobeStatic = require('ffprobe-static')
const Ffmpeg = require('fluent-ffmpeg')

// Resolve binary paths (handle asar unpacking)
function resolveBin(binPath) {
  if (app.isPackaged) {
    return binPath.replace('app.asar', 'app.asar.unpacked')
  }
  return binPath
}

const ffmpegPath = resolveBin(ffmpegStatic)
const ffprobePath = resolveBin(ffprobeStatic.path)

Ffmpeg.setFfmpegPath(ffmpegPath)
Ffmpeg.setFfprobePath(ffprobePath)

let currentCommand = null

// Get audio duration and file size via ffprobe
export function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err)
      resolve({
        duration: metadata.format.duration || 0,
        size: metadata.format.size || 0
      })
    })
  })
}

// Format seconds → HH:MM:SS
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Parse HH:MM:SS.ms → seconds
function parseTimemark(timemark) {
  if (!timemark || typeof timemark !== 'string') return 0
  const parts = timemark.split(':')
  if (parts.length !== 3) return 0
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
}

// Quality presets
const QUALITY_PRESETS = {
  '1080p': { width: 1920, height: 1080, crf: 18, preset: 'slow' },
  '720p':  { width: 1280, height: 720,  crf: 22, preset: 'medium' },
  '480p':  { width: 854,  height: 480,  crf: 26, preset: 'fast' }
}

// Escape text for ffmpeg drawtext filter
function escapeDrawtext(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
}

// Clean chapter name (remove leading number + extension)
function cleanChapterName(name) {
  return name
    .replace(/^\d+[.\s_\-]+/, '')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac)$/i, '')
    .trim()
}

// Main processing function
export async function processAudiobook(config, win) {
  const { audioFiles, coverImage, outputPath, quality, showChapterTitles } = config
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS['1080p']
  const { width, height, crf, preset: encPreset } = preset

  // 1. Get durations for all audio files
  const sendProgress = (percent, stage, extra = {}) => {
    win.webContents.send('ffmpeg:progress', {
      percent,
      stage,
      totalChapters: audioFiles.length,
      ...extra
    })
  }

  sendProgress(0, 'Анализ аудиофайлов...')

  const durations = []
  for (let i = 0; i < audioFiles.length; i++) {
    const { duration: dur } = await getAudioDuration(audioFiles[i].path)
    durations.push(dur)
    sendProgress(
      Math.round((i + 1) / audioFiles.length * 4),
      `Анализ: ${audioFiles[i].name}`,
      { currentChapter: i + 1 }
    )
  }

  const totalDuration = durations.reduce((a, b) => a + b, 0)
  const numAudio = audioFiles.length

  // 2. Build filter_complex string
  // Audio: concat all audio streams
  const audioInputRefs = audioFiles.map((_, i) => `[${i + 1}:a]`).join('')
  const audioConcat = `${audioInputRefs}concat=n=${numAudio}:v=0:a=1[aout]`

  // Video: scale image to preset with letterboxing
  const videoScale =
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
    `format=yuv420p[vbase]`

  let videoMap = '[vbase]'
  let filterParts = [videoScale, audioConcat]

  if (showChapterTitles && numAudio > 0) {
    // Calculate chapter start timestamps
    const timestamps = []
    let t = 0
    for (const dur of durations) {
      timestamps.push(t)
      t += dur
    }

    // Chain drawtext filters
    const fontSize = Math.round(height * 0.040)
    const showDur = 6  // seconds to show chapter title

    let prevLabel = 'vbase'
    for (let i = 0; i < numAudio; i++) {
      const start = timestamps[i]
      const end = start + Math.min(showDur, durations[i])
      const chapterName = escapeDrawtext(cleanChapterName(audioFiles[i].name))
      const outLabel = i === numAudio - 1 ? 'vout' : `vdt${i}`

      filterParts.push(
        `[${prevLabel}]drawtext=` +
        `text='${chapterName}':` +
        `fontsize=${fontSize}:` +
        `fontcolor=white:` +
        `shadowcolor=black@0.8:shadowx=2:shadowy=2:` +
        `x=(w-text_w)/2:` +
        `y=h*0.08:` +
        `enable='between(t\\,${start.toFixed(3)}\\,${end.toFixed(3)})'` +
        `[${outLabel}]`
      )
      prevLabel = outLabel
    }
    videoMap = '[vout]'
  }

  const filterComplex = filterParts.join(';')

  // 3. Run ffmpeg
  return new Promise((resolve, reject) => {
    const cmd = Ffmpeg()

    // Input 0: cover image (loop)
    cmd.input(coverImage).inputOptions(['-loop', '1'])

    // Inputs 1..N: audio files
    for (const file of audioFiles) {
      cmd.input(file.path)
    }

    cmd
      .outputOptions([
        '-filter_complex', filterComplex,
        '-map', videoMap,
        '-map', '[aout]',
        '-c:v', 'libx264',
        '-preset', encPreset,
        '-crf', String(crf),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest'
      ])
      .output(outputPath)
      .on('start', (cmdLine) => {
        console.log('[FFmpeg] Start:', cmdLine.slice(0, 300) + '...')
      })
      .on('progress', (prog) => {
        const elapsed = parseTimemark(prog.timemark)
        const percent = totalDuration > 0
          ? Math.min(99, Math.round(5 + (elapsed / totalDuration) * 94))
          : (prog.percent || 0)

        // Find current chapter by elapsed time
        let currentChapter = 1
        let accum = 0
        for (let i = 0; i < durations.length; i++) {
          accum += durations[i]
          if (elapsed < accum) { currentChapter = i + 1; break }
          if (i === durations.length - 1) currentChapter = durations.length
        }

        sendProgress(percent, `Глава ${currentChapter} из ${numAudio}`, {
          currentChapter,
          elapsed: formatTime(elapsed),
          total: formatTime(totalDuration)
        })
      })
      .on('end', () => {
        currentCommand = null
        sendProgress(100, 'Готово! 🎉')
        win.webContents.send('ffmpeg:complete', { outputPath })
        resolve(outputPath)
      })
      .on('error', (err) => {
        currentCommand = null
        const msg = err.message || String(err)
        if (msg.includes('SIGKILL') || msg.includes('SIGTERM') || msg.includes('ffmpeg was killed')) {
          win.webContents.send('ffmpeg:cancelled')
        } else {
          console.error('[FFmpeg] Error:', msg)
          win.webContents.send('ffmpeg:error', { message: msg })
          reject(err)
        }
      })
      .run()

    currentCommand = cmd
  })
}

export function cancelProcessing() {
  if (currentCommand) {
    try { currentCommand.kill('SIGKILL') } catch (e) { /* ignore */ }
    currentCommand = null
  }
}

// Register all IPC handlers
export function setupFfmpegHandlers(ipcMain, win) {
  ipcMain.handle('ffmpeg:getDuration', async (_, filePath) => {
    try { return await getAudioDuration(filePath) }
    catch (e) { console.error('getDuration error:', e.message); return { duration: 0, size: 0 } }
  })

  ipcMain.on('ffmpeg:process', async (_, config) => {
    try { await processAudiobook(config, win) }
    catch (e) { console.error('Process error:', e.message) }
  })

  ipcMain.on('ffmpeg:cancel', () => cancelProcessing())
}
