import type { EncodingMode, Quality } from '../shared/types'
import { resolveVideoProfile } from './video-profiles'

export interface AudioSourceProbe {
  codec?: string
  durationSec: number
  sizeBytes: number
  bitRateBps?: number
}

export type AudioStrategy = 'copy' | 'aac'

export interface AudioEncodingPlan {
  strategy: AudioStrategy
  inputBitrateKbps: number
  targetBitrateKbps?: number
  description: string
}

const MP4_COPY_CODECS = new Set(['aac', 'mp3', 'alac', 'ac3', 'eac3'])

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function isMp4CopyCodec(codec?: string): boolean {
  if (!codec) return false
  return MP4_COPY_CODECS.has(codec.toLowerCase())
}

export function estimateInputBitrateKbps(sources: AudioSourceProbe[]): number {
  if (!sources.length) return 0

  const totalDuration = sources.reduce((acc, s) => acc + Math.max(0, s.durationSec || 0), 0)
  const totalSizeBytes = sources.reduce((acc, s) => acc + Math.max(0, s.sizeBytes || 0), 0)

  if (totalDuration > 0 && totalSizeBytes > 0) {
    return (totalSizeBytes * 8) / totalDuration / 1000
  }

  const knownBps = sources
    .map(s => s.bitRateBps || 0)
    .filter(v => Number.isFinite(v) && v > 0)

  if (!knownBps.length) return 0
  return knownBps.reduce((a, b) => a + b, 0) / knownBps.length / 1000
}

export function selectAacBitrateKbps(inputKbps: number): number {
  if (!Number.isFinite(inputKbps) || inputKbps <= 0) return 128
  const roundedTo16 = Math.round(inputKbps / 16) * 16
  return clamp(roundedTo16, 64, 160)
}

export function planAudioEncoding(sources: AudioSourceProbe[]): AudioEncodingPlan {
  const inputKbps = estimateInputBitrateKbps(sources)
  const sourceCount = sources.length
  const firstCodec = sources[0]?.codec

  if (sourceCount === 1 && isMp4CopyCodec(firstCodec)) {
    const codecLabel = firstCodec ? firstCodec.toUpperCase() : 'аудио'
    return {
      strategy: 'copy',
      inputBitrateKbps: inputKbps,
      description: `Без перекодирования (${codecLabel})`
    }
  }

  const targetKbps = selectAacBitrateKbps(inputKbps)
  return {
    strategy: 'aac',
    inputBitrateKbps: inputKbps,
    targetBitrateKbps: targetKbps,
    description: `AAC ${targetKbps} кбит/с`
  }
}

export function estimateOutputSizeBytes(
  durationSec: number,
  plan: AudioEncodingPlan,
  sourceTotalBytes: number,
  quality: Quality,
  encodingMode: EncodingMode = 'min_size'
): number {
  const safeDuration = Math.max(0, durationSec || 0)
  const safeSourceBytes = Math.max(0, sourceTotalBytes || 0)

  const audioBytes = plan.strategy === 'copy'
    ? safeSourceBytes
    : (safeDuration * ((plan.targetBitrateKbps || 128) * 1000)) / 8

  const videoProfile = resolveVideoProfile(quality, encodingMode)
  const videoBytes = (safeDuration * (videoProfile.estimateVideoKbps * 1000)) / 8

  // Container overhead + chapters metadata safety margin.
  const overheadBytes = 2 * 1024 * 1024
  return Math.round(audioBytes + videoBytes + overheadBytes)
}
