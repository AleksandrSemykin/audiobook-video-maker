import type { EncodingMode, Language, Quality, UploadTarget } from '../shared/types'
import { resolveVideoProfile } from './video-profiles'
import { getEncodingTexts } from './i18n'

export interface AudioSourceProbe {
  codec?: string
  durationSec: number
  sizeBytes: number
  bitRateBps?: number
  sampleRateHz?: number
  channels?: number
}

export type AudioStrategy = 'copy' | 'aac'

export interface AudioEncodingPlan {
  strategy: AudioStrategy
  inputBitrateKbps: number
  targetBitrateKbps?: number
  description: string
}

const UNIVERSAL_MP4_COPY_CODECS = new Set(['aac'])
const YOUTUBE_FAST_MP4_COPY_CODECS = new Set(['aac', 'mp3', 'alac', 'ac3', 'eac3'])

function getMp4CopyCodecs(uploadTarget: UploadTarget = 'universal'): Set<string> {
  return uploadTarget === 'youtube_fast'
    ? YOUTUBE_FAST_MP4_COPY_CODECS
    : UNIVERSAL_MP4_COPY_CODECS
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function isMp4CopyCodec(codec?: string, uploadTarget: UploadTarget = 'universal'): boolean {
  if (!codec) return false
  return getMp4CopyCodecs(uploadTarget).has(codec.toLowerCase())
}

function normalizeCodec(codec?: string): string {
  return String(codec ?? '').toLowerCase()
}

function hasValidAudioParam(value?: number): boolean {
  return Number.isFinite(value) && (value || 0) > 0
}

export function canStreamCopyConcat(
  sources: AudioSourceProbe[],
  uploadTarget: UploadTarget = 'universal'
): boolean {
  if (sources.length < 2) return false

  const first = sources[0]
  const firstCodec = normalizeCodec(first.codec)
  const firstSampleRate = first.sampleRateHz
  const firstChannels = first.channels

  if (!isMp4CopyCodec(firstCodec, uploadTarget)) return false
  if (!hasValidAudioParam(firstSampleRate) || !hasValidAudioParam(firstChannels)) return false

  return sources.every((source) => {
    if (!isMp4CopyCodec(source.codec, uploadTarget)) return false
    if (normalizeCodec(source.codec) !== firstCodec) return false
    if (!hasValidAudioParam(source.sampleRateHz) || !hasValidAudioParam(source.channels)) return false
    return source.sampleRateHz === firstSampleRate && source.channels === firstChannels
  })
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

export function planAudioEncoding(
  sources: AudioSourceProbe[],
  language: Language = 'ru',
  uploadTarget: UploadTarget = 'universal'
): AudioEncodingPlan {
  const texts = getEncodingTexts(language)
  const inputKbps = estimateInputBitrateKbps(sources)
  const sourceCount = sources.length
  const firstCodec = sources[0]?.codec

  if (sourceCount === 1 && isMp4CopyCodec(firstCodec, uploadTarget)) {
    const codecLabel = firstCodec ? firstCodec.toUpperCase() : texts.fallbackCodecLabel
    return {
      strategy: 'copy',
      inputBitrateKbps: inputKbps,
      description: texts.noReencode(codecLabel)
    }
  }

  if (canStreamCopyConcat(sources, uploadTarget)) {
    const codecLabel = firstCodec ? firstCodec.toUpperCase() : texts.fallbackCodecLabel
    return {
      strategy: 'copy',
      inputBitrateKbps: inputKbps,
      description: texts.noReencodeConcat(codecLabel)
    }
  }

  const targetKbps = selectAacBitrateKbps(inputKbps)
  return {
    strategy: 'aac',
    inputBitrateKbps: inputKbps,
    targetBitrateKbps: targetKbps,
    description: texts.aacBitrate(targetKbps)
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
