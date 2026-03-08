import { app, BrowserWindow, IpcMain } from 'electron'
import { createRequire } from 'module'
import { execFile } from 'child_process'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { extname, join } from 'path'
import type { FfprobeData } from 'fluent-ffmpeg'
import type { Language, ProcessConfig } from '../shared/types'
import {
  canStreamCopyConcat,
  estimateOutputSizeBytes,
  planAudioEncoding,
  type AudioEncodingPlan,
  type AudioSourceProbe
} from './encoding-plan'
import {
  buildVideoOutputOptions,
  resolveVideoProfile,
  type HWEncoder
} from './video-profiles'
import { formatWallTimeLocalized, getMainFfmpeg } from './i18n'

// Use createRequire for CJS packages in ESM context
const require = createRequire(import.meta.url)
const ffmpegStatic: string = require('ffmpeg-static')
const ffprobeStatic: { path: string } = require('ffprobe-static')
const Ffmpeg: typeof import('fluent-ffmpeg') = require('fluent-ffmpeg')

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

const OUTPUT_FPS = 25

interface AudioProbeResult {
  duration: number
  size: number
  bitRateBps: number
  codec: string
  sampleRateHz: number
  channels: number
}

interface PreparedConcatInput {
  listPath: string
  cleanup: () => void
}

// Get extended audio info via ffprobe
async function getAudioProbe(filePath: string): Promise<AudioProbeResult> {
  return new Promise((resolve, reject) => {
    Ffmpeg.ffprobe(filePath, (err: Error | null, metadata: FfprobeData) => {
      if (err) return reject(err)

      const fmt = metadata.format ?? {}
      const audioStream = metadata.streams?.find((s) => s.codec_type === 'audio')
      const duration = Number(fmt.duration ?? audioStream?.duration ?? 0)
      const size = Number(fmt.size ?? 0)
      const bitRateBps = Number(audioStream?.bit_rate ?? fmt.bit_rate ?? 0)
      const sampleRateHz = Number(audioStream?.sample_rate ?? 0)
      const channels = Number(audioStream?.channels ?? 0)

      resolve({
        duration: Number.isFinite(duration) ? duration : 0,
        size: Number.isFinite(size) ? size : 0,
        bitRateBps: Number.isFinite(bitRateBps) ? bitRateBps : 0,
        codec: String(audioStream?.codec_name ?? ''),
        sampleRateHz: Number.isFinite(sampleRateHz) ? sampleRateHz : 0,
        channels: Number.isFinite(channels) ? channels : 0
      })
    })
  })
}

// Get audio duration and file size via ffprobe (renderer helper)
export async function getAudioDuration(filePath: string): Promise<{ duration: number; size: number }> {
  const { duration, size } = await getAudioProbe(filePath)
  return { duration, size }
}

// Format seconds → HH:MM:SS
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// Format bytes as human-readable size/speed
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

// Parse HH:MM:SS.ms → seconds
function parseTimemark(timemark: string | undefined): number {
  if (!timemark || typeof timemark !== 'string') return 0
  const parts = timemark.split(':')
  if (parts.length !== 3) return 0
  return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
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

function escapeConcatFilePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

function prepareConcatInputFile(audioFiles: Array<{ path: string }>): PreparedConcatInput {
  const dirPath = mkdtempSync(join(tmpdir(), 'abvm-concat-'))
  const listPath = join(dirPath, 'inputs.txt')
  const content = audioFiles.map((file) => `file '${escapeConcatFilePath(file.path)}'`).join('\n') + '\n'
  writeFileSync(listPath, content, { encoding: 'utf8' })
  return {
    listPath,
    cleanup: () => {
      try { rmSync(dirPath, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  }
}

// ─── Hardware-encoder detection ──────────────────────────────────────────────

let _cachedEncoder: HWEncoder | null = null

function getAvailableEncoders(): Promise<string> {
  return new Promise((resolve) => {
    execFile(ffmpegPath, ['-hide_banner', '-encoders'], (_err, stdout) => {
      resolve(stdout ?? '')
    })
  })
}

function probeHardwareEncoder(encoder: Exclude<HWEncoder, 'libx264'>): Promise<boolean> {
  return new Promise((resolve) => {
    const probeProfile = resolveVideoProfile('720p', 'min_size')
    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-f', 'lavfi',
      '-i', `color=c=black:s=${probeProfile.width}x${probeProfile.height}:r=1:d=1`,
      '-frames:v', '1',
      '-an',
      ...buildVideoOutputOptions(encoder, probeProfile),
      '-f', 'null',
      '-'
    ]

    execFile(ffmpegPath, args, (err, _stdout, stderr) => {
      if (!err) {
        resolve(true)
        return
      }

      const details = String(stderr ?? '').trim().split(/\r?\n/).slice(-1)[0] || (err.message || String(err))
      console.warn(`[FFmpeg] Probe failed for ${encoder}: ${details}`)
      resolve(false)
    })
  })
}

async function detectEncoder(): Promise<HWEncoder> {
  if (_cachedEncoder) return _cachedEncoder

  const out = await getAvailableEncoders()
  const candidates: Array<Exclude<HWEncoder, 'libx264'>> = ['h264_nvenc', 'h264_qsv', 'h264_amf']

  for (const enc of candidates) {
    if (!out.includes(enc)) continue
    const ok = await probeHardwareEncoder(enc)
    if (ok) {
      _cachedEncoder = enc
      console.log(`[FFmpeg] Selected encoder: ${enc}`)
      return enc
    }
  }

  _cachedEncoder = 'libx264'
  console.log('[FFmpeg] Selected encoder: libx264')
  return _cachedEncoder
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
  const {
    audioFiles,
    coverImage,
    outputPath,
    quality,
    encodingMode = 'min_size',
    showChapterTitles,
    language = 'ru'
  } = config
  const lang: Language = language
  const t = getMainFfmpeg(lang)
  const videoProfile = resolveVideoProfile(quality, encodingMode, lang)
  const { width, height } = videoProfile
  const isAnimatedCover = extname(coverImage).toLowerCase() === '.gif'

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

  sendProgress(0, t.analyzingAudioFiles)

  // Detect best available encoder once (result is cached for subsequent calls)
  const encoder = await detectEncoder()
  encoderLabel = ENCODER_LABELS[encoder]
  encoderId = encoder

  const durations: number[] = []
  const audioSources: AudioSourceProbe[] = []
  for (let i = 0; i < audioFiles.length; i++) {
    const probe = await getAudioProbe(audioFiles[i].path)
    durations.push(probe.duration)
    audioSources.push({
      codec: probe.codec,
      durationSec: probe.duration,
      sizeBytes: probe.size,
      bitRateBps: probe.bitRateBps,
      sampleRateHz: probe.sampleRateHz,
      channels: probe.channels
    })
    sendProgress(
      Math.round((i + 1) / audioFiles.length * 4),
      t.analyzingFile(audioFiles[i].name),
      { currentChapter: i + 1 }
    )
  }

  const audioPlan: AudioEncodingPlan = planAudioEncoding(audioSources, lang)
  const canCopyConcatAudio = canStreamCopyConcat(audioSources)
  const totalSourceAudioBytes = audioSources.reduce((sum, item) => sum + (item.sizeBytes || 0), 0)
  const totalDuration = durations.reduce((a, b) => a + b, 0)
  const numAudio = audioFiles.length
  const estimatedOutputBytes = estimateOutputSizeBytes(
    totalDuration,
    audioPlan,
    totalSourceAudioBytes,
    quality,
    encodingMode
  )

  sendProgress(
    5,
    t.preparation(audioPlan.description, videoProfile.modeLabel, formatBytes(estimatedOutputBytes))
  )
  const audioModeLabel = audioPlan.strategy === 'copy'
    ? (numAudio > 1 && canCopyConcatAudio ? t.audioCopyConcat : t.audioCopy)
    : t.audioAac(audioPlan.targetBitrateKbps || 128)

  // 2. Build filter_complex string
  const shouldCopySingleAudio = numAudio === 1 && audioPlan.strategy === 'copy'
  const shouldCopyConcatAudio = numAudio > 1 && canCopyConcatAudio
  const shouldCopyAudioDirect = shouldCopySingleAudio || shouldCopyConcatAudio

  // Video: scale image to preset with letterboxing
  const videoScale =
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,` +
    `fps=${OUTPUT_FPS},` +
    `format=yuv420p[vbase]`

  let audioMap = '[aout]'
  let videoMap = '[vbase]'
  const filterParts: string[] = [videoScale]

  if (!shouldCopyAudioDirect) {
    // Multi-file mode requires decoded concat, then re-encode audio.
    const audioInputRefs = audioFiles.map((_, i) => `[${i + 1}:a]`).join('')
    const audioConcat = `${audioInputRefs}concat=n=${numAudio}:v=0:a=1[aout]`
    filterParts.push(audioConcat)
  } else {
    // Compatible source can be stream-copied to avoid size bloat and extra CPU work.
    audioMap = '1:a:0'
  }

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
  const concatInput = shouldCopyConcatAudio ? prepareConcatInputFile(audioFiles) : null

  // Wall-clock timestamp when ffmpeg actually starts encoding (set in on('start'))
  let startWallMs = 0
  let lastElapsedRaw = 0
  let lastElapsedAdvanceMs = 0
  const FINALIZATION_NEAR_END_SEC = 1
  const FINALIZATION_STALL_MS = 20_000
  // Finalization tracker (stage after audio timeline has ended)
  let finalizationStartedMs = 0
  let finalizationLastSampleMs = 0
  let finalizationLastSizeBytes = 0
  let finalizationGrowthBps = 0
  let finalizationTimer: NodeJS.Timeout | null = null

  const readOutputSizeBytes = (targetSizeKb?: number): number => {
    if (typeof targetSizeKb === 'number' && Number.isFinite(targetSizeKb) && targetSizeKb > 0) {
      return Math.round(targetSizeKb * 1024)
    }
    try {
      return statSync(outputPath).size
    } catch {
      return 0
    }
  }

  const updateFinalizationSample = (sizeBytes: number): void => {
    if (sizeBytes <= 0) return
    const now = Date.now()
    if (finalizationLastSampleMs > 0 && sizeBytes >= finalizationLastSizeBytes) {
      const dt = (now - finalizationLastSampleMs) / 1000
      if (dt >= 0.5) {
        finalizationGrowthBps = (sizeBytes - finalizationLastSizeBytes) / dt
      }
    }
    finalizationLastSampleMs = now
    finalizationLastSizeBytes = sizeBytes
  }

  const sendFinalizationProgress = (targetSizeKb?: number): void => {
    const now = Date.now()
    if (finalizationStartedMs === 0) {
      finalizationStartedMs = now
      finalizationLastSampleMs = now
    }

    const sizeBytes = readOutputSizeBytes(targetSizeKb)
    updateFinalizationSample(sizeBytes)

    const finalizationElapsedSec = (now - finalizationStartedMs) / 1000
    const details: string[] = [`${t.elapsedLabel} ${formatWallTimeLocalized(finalizationElapsedSec, lang)}`]
    if (sizeBytes > 0) details.push(`${t.sizeLabel} ${formatBytes(sizeBytes)}`)
    if (finalizationGrowthBps > 0) details.push(`${t.writeLabel} ${formatBytes(finalizationGrowthBps)}${t.perSecond}`)
    details.push(audioModeLabel)
    details.push(videoProfile.modeLabel)

    sendProgress(99, t.finalizing(details.join(' • ')), {
      currentChapter: numAudio,
      elapsed: totalDuration > 0 ? formatTime(totalDuration) : undefined,
      total: totalDuration > 0 ? formatTime(totalDuration) : undefined,
      eta: undefined,
      isFinalizing: true
    })
  }

  const startFinalizationTicker = (): void => {
    if (finalizationTimer) return
    finalizationTimer = setInterval(() => {
      sendFinalizationProgress()
    }, 1000)
  }

  const stopFinalizationTicker = (): void => {
    if (!finalizationTimer) return
    clearInterval(finalizationTimer)
    finalizationTimer = null
  }

  const resetFinalizationState = (): void => {
    finalizationStartedMs = 0
    finalizationLastSampleMs = 0
    finalizationLastSizeBytes = 0
    finalizationGrowthBps = 0
  }

  const leaveFinalizationMode = (): void => {
    stopFinalizationTicker()
    resetFinalizationState()
  }

  // 3. Run ffmpeg
  return new Promise((resolve, reject) => {
    let activeEncoder: HWEncoder = encoder
    let retriedOnCpu = false
    let concatInputCleaned = false

    const cleanupConcatInput = (): void => {
      if (concatInput && !concatInputCleaned) {
        concatInput.cleanup()
        concatInputCleaned = true
      }
    }

    const startCommand = (): void => {
      const cmd = Ffmpeg()
      const audioOutputOptions = shouldCopyAudioDirect
        ? ['-c:a', 'copy']
        : ['-c:a', 'aac', '-b:a', `${audioPlan.targetBitrateKbps || 128}k`]

      // Input 0: cover media.
      // Static images are looped at 1 fps to avoid processing identical frames.
      // GIF covers keep animation and are looped infinitely for full audio length.
      if (isAnimatedCover) {
        cmd.input(coverImage).inputOptions(['-stream_loop', '-1'])
      } else {
        cmd.input(coverImage).inputOptions(['-loop', '1', '-r', '1'])
      }

      // Audio inputs
      if (concatInput) {
        cmd.input(concatInput.listPath).inputOptions(['-f', 'concat', '-safe', '0'])
      } else {
        for (const file of audioFiles) {
          cmd.input(file.path)
        }
      }

      cmd
        .outputOptions([
          '-filter_complex', filterComplex,
          '-map', videoMap,
          '-map', audioMap,
          ...buildVideoOutputOptions(activeEncoder, videoProfile, !isAnimatedCover),
          ...audioOutputOptions,
          '-movflags', '+faststart',
          '-shortest',
          // Use all available CPU cores for the filter pipeline so it feeds
          // the GPU encoder as fast as possible.
          '-threads', '0'
        ])
        .output(outputPath)
        .on('start', (cmdLine: string) => {
          console.log('[FFmpeg] Start:', cmdLine.slice(0, 300) + '...')
          startWallMs = Date.now()
          lastElapsedAdvanceMs = startWallMs
        })
        .on('progress', (prog: { timemark?: string; percent?: number; targetSize?: number }) => {
          const elapsedRaw = parseTimemark(prog.timemark)
          const now = Date.now()

          if (elapsedRaw > lastElapsedRaw + 0.05) {
            lastElapsedRaw = elapsedRaw
            lastElapsedAdvanceMs = now
            if (finalizationTimer) leaveFinalizationMode()
          }

          const nearEnd = totalDuration > 0 && elapsedRaw >= Math.max(0, totalDuration - FINALIZATION_NEAR_END_SEC)
          const stalledNearEnd = nearEnd && (now - lastElapsedAdvanceMs >= FINALIZATION_STALL_MS)
          if (stalledNearEnd) {
            sendFinalizationProgress(prog.targetSize)
            startFinalizationTicker()
            return
          }

          const elapsed = totalDuration > 0 ? Math.min(elapsedRaw, totalDuration) : elapsedRaw

          const percent = totalDuration > 0
            ? Math.min(99, Math.round(5 + (elapsed / totalDuration) * 94))
            : Math.min(99, Math.round(prog.percent ?? 0))

          // ETA: extrapolate from real wall-clock speed
          let eta: string | undefined
          const wallElapsed = (Date.now() - startWallMs) / 1000
          const ratio = totalDuration > 0 ? elapsed / totalDuration : 0
          if (ratio > 0.01 && wallElapsed > 1) {
            const remaining = Math.max(0, (wallElapsed / ratio) - wallElapsed)
            if (remaining > 0) eta = formatTime(remaining)
          }

          // Find current chapter by elapsed time
          let currentChapter = durations.length > 0 ? 1 : 0
          let accum = 0
          for (let i = 0; i < durations.length; i++) {
            accum += durations[i]
            if (elapsed < accum) { currentChapter = i + 1; break }
            if (i === durations.length - 1) currentChapter = durations.length
          }

          sendProgress(percent, t.chapterProgress(currentChapter, numAudio), {
            currentChapter,
            elapsed: formatTime(elapsed),
            total: totalDuration > 0 ? formatTime(totalDuration) : undefined,
            eta,
            isFinalizing: false
          })
        })
        .on('end', () => {
          leaveFinalizationMode()
          cleanupConcatInput()
          currentCommand = null
          // Do NOT call sendProgress here — ffmpeg:complete is sent on a different
          // IPC channel and could be reordered with a late ffmpeg:progress event,
          // leaving isProcessing stuck as true in the renderer.
          const totalTime = formatWallTimeLocalized((Date.now() - startWallMs) / 1000, lang)
          win.webContents.send('ffmpeg:complete', { outputPath, totalTime })
          resolve(outputPath)
        })
        .on('error', (err: Error) => {
          leaveFinalizationMode()
          currentCommand = null
          const msg = err.message || String(err)
          if (msg.includes('SIGKILL') || msg.includes('SIGTERM') || msg.includes('ffmpeg was killed')) {
            cleanupConcatInput()
            win.webContents.send('ffmpeg:cancelled')
            return
          }

          // Hardware encoders can be listed by ffmpeg but still fail at runtime
          // (missing driver/device or unsupported params). Retry once on CPU.
          if (!retriedOnCpu && activeEncoder !== 'libx264') {
            const failedEncoder = activeEncoder
            retriedOnCpu = true
            activeEncoder = 'libx264'
            encoderLabel = ENCODER_LABELS[activeEncoder]
            encoderId = activeEncoder
            lastElapsedRaw = 0
            lastElapsedAdvanceMs = Date.now()
            resetFinalizationState()
            sendProgress(
              5,
              lang === 'ru'
                ? `Аппаратный энкодер ${ENCODER_LABELS[failedEncoder]} недоступен, повтор на CPU...`
                : `Hardware encoder ${ENCODER_LABELS[failedEncoder]} unavailable, retrying on CPU...`,
              { isFinalizing: false }
            )
            console.warn(`[FFmpeg] ${failedEncoder} failed, retrying with libx264: ${msg}`)
            startCommand()
            return
          }

          cleanupConcatInput()
          console.error('[FFmpeg] Error:', msg)
          win.webContents.send('ffmpeg:error', { message: msg })
          reject(err)
        })
        .run()

      currentCommand = cmd
    }

    startCommand()
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
