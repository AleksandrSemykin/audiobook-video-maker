import React from 'react'
import type { Language, ProgressData } from '../../../shared/types'
import { getRendererTexts } from '../i18n'

interface ProgressBarProps {
  progress: ProgressData & { isProcessing?: boolean }
  onCancel: () => void
  onOpenFolder: () => void
  outputPath: string | null
  language: Language
}

const ENCODER_ICONS: Record<string, string> = {
  'h264_nvenc': '⚡',
  'h264_qsv':  '⚡',
  'h264_amf':  '⚡',
  'libx264':   '🖥',
}

export function ProgressBar({ progress, language }: ProgressBarProps): React.ReactElement {
  const t = getRendererTexts(language)
  const {
    percent = 0,
    stage = '',
    elapsed,
    total,
    eta,
    isProcessing,
    isFinalizing,
    encoderLabel,
    encoderId
  } = progress

  const showEncoder = isProcessing && !!encoderLabel
  const isGpu = encoderId ? encoderId !== 'libx264' : false
  const icon = encoderId ? (ENCODER_ICONS[encoderId] ?? '🖥') : ''
  const isIndeterminate = !!isProcessing && (percent < 5 || !!isFinalizing)

  return (
    <div className="progress-container">
      <div className="progress-track">
        <div
          className={`progress-fill${isIndeterminate ? ' indeterminate' : ''}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="progress-info">
        <span className="progress-stage">
          {stage}
          {elapsed && total ? ` · ${elapsed} / ${total}` : ''}
          {eta ? <span className="progress-eta"> · {t.progress.etaPrefix}{eta}</span> : null}
        </span>
        {showEncoder && (
          <span className={`encoder-badge${isGpu ? ' encoder-badge--gpu' : ' encoder-badge--cpu'}`}>
            {icon} {encoderLabel}
          </span>
        )}
        <span className="progress-percent">
          {isProcessing ? `${percent}%` : ''}
        </span>
      </div>
    </div>
  )
}
