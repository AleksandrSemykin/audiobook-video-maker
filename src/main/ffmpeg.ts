import { app, BrowserWindow, IpcMain } from 'electron'
import { createRequire } from 'module'
import { execFile } from 'child_process'
import type { FfprobeData } from 'fluent-ffmpeg'
import type { ProcessConfig } from '../shared/types'

// Use createRequire for CJS packages in ESM context
const require = createRequire(import.meta.url)
const ffmpegStatic: string = require('ffmpeg-static')
const ffprobeStatic: { path: string } = require('ffprobe-static')
const Ffmpeg: typeof import('fluent-ffmpeg') = require('fluent-ffmpeg')

// Quality preset definition
interface QualityPreset {
  width: number
  height: number
  crf: number
  preset: string
}

// Resolve binary paths (handle asar unpacking)
function resolveBin(binPath: string): string {
  if (app.isPackaged) {
    return binPath.replace('app.asar', 'app.asar.unpacked')
  }
  return binPath
}

const ffmpegPath = resolveBin(ffmpegStatic)
const ffprobePath = resolveBin(ffprobeStatic.path)

Ffmpeg.setFfmpegPath(ffmpegPath)
Ffmpeg.setFfprobePath(ffprobePath)

let currentCommand: ReturnType<typeof Ffmpeg> | null = null

// Get audio duration and file size via ffprobe
export function getAudioDuration(filePath: string): Promise<{ duration: number; size: number }> {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(filePath, (err: Error | null, metadata: FfprobeData) => {
      if (err) return reject(err)
      resolve({
        duration: metadata.format.duration ?? 0,
        size: metadata.format.size ?? 0
      })
    })
  })
}

// Format seconds → HH:MM:SS
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Parse HH:MM:SS.ms → seconds
function parseTimemark(timemark: string | undefined): number {
  if (!timemark || typeof timemark !== 'string') return 0
  const parts = timemark.split(':')
  if (parts.length !== 3) return 0
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
}

// Quality presets (presets tuned for static-image video — CPU fallback path)
const QUALITY_PRESETS: Record<string, QualityPreset> = {
  '1080p': { width: 1920, height: 1080, crf: 18, preset: 'fast' },
  '720p':  { width: 1280, height: 720,  crf: 22, preset: 'fast' },
  '480p':  { width: 854,  height: 480,  crf: 26, preset: 'fast' }
}

// Escape text for ffmpeg drawtext filter
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
}

// Clean chapter name (remove leading number + extension)
function cleanChapterName(name: string): string {
  return name
    .replace(/^\d+[.\s_\-]+/, '')
    .replace(/\.(mp3|wav|flac|m4a|ogg|aac)$/i, '')
    .trim()
}

// ─── Hardware-encoder detection ──────────────────────────────────────────────

type HWEncoder = 'libx264' | 'h264_nvenc' | 'h264_qsv' | 'h264_amf'

let _cachedEncoder: HWEncoder | null = null

function detectEncoder(): Promise<HWEncoder> {
  if (_cachedEncoder) return Promise.resolve(_cachedEncoder)
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-encoders'], (_err, stdout) => {
      const out = stdout ?? ''
      let enc: HWEncoder = 'libx264'
      if (out.includes('h264_nvenc')) enc = 'h264_nvenc'
      else if (out.includes('h264_qsv'))  enc = 'h264_qsv'
      else if (out.includes('h264_amf'))  enc = 'h264_amf'
      _cachedEncoder = enc
      console.log(`[FFmpeg] Selected encoder: ${enc}`)
      resolve(enc)
    })
  })
}

/**
 * Build the -c:v … output options for the detected encoder.
 * All paths also set a large GOP (-g 500) because the source is a
 * static image — inter-frame coding is essentially free after the
 * first keyframe, making a large GOP safe and beneficial.
 */
function buildVideoOutputOptions(encoder: HWEncoder, crf: number, cpuPreset: string): string[] {
  const gop = ['-g', '500']

  switch (encoder) {
    case 'h264_nvenc':
      // NVENC: VBR constant-quality mode; p4 = balanced speed/quality
      return [
        '-c:v', 'h264_nvenc',
        '-preset', 'p4',
        '-rc', 'vbr',
        '-cq', String(crf),
        '-b:v', '0',
        ...gop
      ]

    case 'h264_qsv':
      // Intel Quick Sync: global_quality ≈ CRF, look_ahead for better quality
      return [
        '-c:v', 'h264_qsv',
        '-preset', 'medium',
        '-global_quality', String(crf),
        '-look_ahead', '1',
        ...gop
      ]

    case 'h264_amf':
      // AMD AMF: constant-QP mode
      return [
        '-c:v', 'h264_amf',
        '-quality', 'balanced',
        '-rc', 'cqp',
        '-qp_i', String(crf),
        '-qp_p', String(crf),
        ...gop
      ]

    default:
      // libx264: tune stillimage disables motion-estimation overhead;
      // fast preset + large GOP ≈ 3–5× speedup vs slow for static content.
      return [
        '-c:v', 'libx264',
        '-preset', cpuPreset,
        '-crf', String(crf),
        '-tune', 'stillimage',
        ...gop
      ]
  }
}

// ──────────────────────────────────────────────────────────────────────────────

const ENCODER_LABELS: Record<HWEncoder, string> = {
  'h264_nvenc': 'NVIDIA GPU',
  'h264_qsv':  'Intel Quick Sync',
  'h264_amf':  'AMD GPU',
  'libx264':   'CPU'
}

// Main processing function
export async function processAudiobook(config: ProcessConfig, win: BrowserWindow): Promise<string> {
  const { audioFiles, coverImage, outputPath, quality, showChapterTitles } = config
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS['1080p']
  const { width, height, crf, preset: encPreset } = preset

  // 1. Get durations for all audio files
  // Encoder info is attached to every progress event so the renderer
  // can display a persistent hardware badge throughout encoding.
  let encoderLabel = ''
  let encoderId = ''

  const sendProgress = (percent: number, stage: string, extra: Record<string, unknown> = {}): void => {
    win.webContents.send('ffmpeg:progress', {
      percent,
      stage,
      totalChapters: audioFiles.length,
      encoderLabel: encoderLabel || undefined,
      encoderId: encoderId || undefined,
      ...extra
    })
  }

  sendProgress(0, 'Анализ аудиофайлов...')

  // Detect best available encoder once (result is cached for subsequent calls)
  const encoder = await detectEncoder()
  encoderLabel = ENCODER_LABELS[encoder]
  encoderId = encoder

  const durations: number[] = []
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
  const filterParts: string[] = [videoScale, audioConcat]

  if (showChapterTitles && numAudio > 0) {
    // Calculate chapter start timestamps
    const timestamps: number[] = []
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

  // Wall-clock timestamp when ffmpeg actually starts encoding (set in on('start'))
  let startWallMs = 0

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
        ...buildVideoOutputOptions(encoder, crf, encPreset),
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        '-shortest'
      ])
      .output(outputPath)
      .on('start', (cmdLine: string) => {
        console.log('[FFmpeg] Start:', cmdLine.slice(0, 300) + '...')
        startWallMs = Date.now()
      })
      .on('progress', (prog: { timemark?: string; percent?: number }) => {
        const elapsed = parseTimemark(prog.timemark)
        const percent = totalDuration > 0
          ? Math.min(99, Math.round(5 + (elapsed / totalDuration) * 94))
          : (prog.percent ?? 0)

        // ETA: extrapolate from real wall-clock speed
        let eta: string | undefined
        const wallElapsed = (Date.now() - startWallMs) / 1000
        const ratio = totalDuration > 0 ? elapsed / totalDuration : 0
        if (ratio > 0.01 && wallElapsed > 1) {
          const remaining = Math.max(0, (wallElapsed / ratio) - wallElapsed)
          if (remaining > 0) eta = formatTime(remaining)
        }

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
          total: formatTime(totalDuration),
          eta
        })
      })
      .on('end', () => {
        currentCommand = null
        // Do NOT call sendProgress here — ffmpeg:complete is sent on a different
        // IPC channel and could be reordered with a late ffmpeg:progress event,
        // leaving isProcessing stuck as true in the renderer.
        win.webContents.send('ffmpeg:complete', { outputPath })
        resolve(outputPath)
      })
      .on('error', (err: Error) => {
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

export function cancelProcessing(): void {
  if (currentCommand) {
    try { currentCommand.kill('SIGKILL') } catch (e) { /* ignore */ }
    currentCommand = null
  }
}

// Register all IPC handlers
export function setupFfmpegHandlers(ipcMain: IpcMain, win: BrowserWindow): void {
  ipcMain.handle('ffmpeg:getDuration', async (_event, filePath: string) => {
    try { return await getAudioDuration(filePath) }
    catch (e) { console.error('getDuration error:', (e as Error).message); return { duration: 0, size: 0 } }
  })

  ipcMain.on('ffmpeg:process', async (_event, config: ProcessConfig) => {
    try { await processAudiobook(config, win) }
    catch (e) { console.error('Process error:', (e as Error).message) }
  })

  ipcMain.on('ffmpeg:cancel', () => cancelProcessing())
}
