import type { EncodingMode, Language, Quality } from '../shared/types'
import { getModeLabel } from './i18n'

export type HWEncoder = 'libx264' | 'h264_nvenc' | 'h264_qsv' | 'h264_amf'

interface ModePreset {
  crf: number
  cpuPreset: string
  estimateVideoKbps: number
}

interface QualityPreset {
  width: number
  height: number
  modePresets: Record<EncodingMode, ModePreset>
}

export interface VideoProfile {
  quality: Quality
  mode: EncodingMode
  width: number
  height: number
  crf: number
  cpuPreset: string
  estimateVideoKbps: number
  modeLabel: string
}

const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  '1080p': {
    width: 1920,
    height: 1080,
    modePresets: {
      max_quality: { crf: 28, cpuPreset: 'medium', estimateVideoKbps: 65 },
      min_size: { crf: 34, cpuPreset: 'fast', estimateVideoKbps: 25 }
    }
  },
  '720p': {
    width: 1280,
    height: 720,
    modePresets: {
      max_quality: { crf: 30, cpuPreset: 'medium', estimateVideoKbps: 45 },
      min_size: { crf: 36, cpuPreset: 'fast', estimateVideoKbps: 18 }
    }
  },
  '480p': {
    width: 854,
    height: 480,
    modePresets: {
      max_quality: { crf: 32, cpuPreset: 'medium', estimateVideoKbps: 30 },
      min_size: { crf: 38, cpuPreset: 'fast', estimateVideoKbps: 12 }
    }
  }
}

export function resolveVideoProfile(
  quality: Quality,
  mode: EncodingMode = 'min_size',
  language: Language = 'ru'
): VideoProfile {
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS['1080p']
  const modePreset = preset.modePresets[mode] ?? preset.modePresets.min_size

  return {
    quality,
    mode,
    width: preset.width,
    height: preset.height,
    crf: modePreset.crf,
    cpuPreset: modePreset.cpuPreset,
    estimateVideoKbps: modePreset.estimateVideoKbps,
    modeLabel: getModeLabel(mode, language)
  }
}

export function buildVideoOutputOptions(
  encoder: HWEncoder,
  profile: VideoProfile,
  useStillImageTune = true
): string[] {
  const gop = ['-g', '30']

  switch (encoder) {
    case 'h264_nvenc':
      return [
        '-c:v', 'h264_nvenc',
        '-preset', profile.mode === 'max_quality' ? 'p4' : 'p1',
        '-rc', 'constqp',
        '-qp', String(profile.crf),
        ...gop
      ]

    case 'h264_qsv':
      return [
        '-c:v', 'h264_qsv',
        '-preset', profile.mode === 'max_quality' ? 'medium' : 'faster',
        '-global_quality', String(profile.crf),
        '-look_ahead', '0',
        '-async_depth', '4',
        ...gop
      ]

    case 'h264_amf':
      return [
        '-c:v', 'h264_amf',
        '-quality', profile.mode === 'max_quality' ? 'balanced' : 'speed',
        '-rc', 'cqp',
        '-qp_i', String(profile.crf),
        '-qp_p', String(profile.crf),
        '-preanalysis', '0',
        ...gop
      ]

    default:
      return [
        '-c:v', 'libx264',
        '-preset', profile.cpuPreset,
        '-crf', String(profile.crf),
        ...(useStillImageTune ? ['-tune', 'stillimage'] : []),
        '-g', profile.mode === 'max_quality' ? '240' : '500'
      ]
  }
}
