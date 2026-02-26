import React from 'react'
import type { ProgressData } from '../../../shared/types'

interface ProgressBarProps {
  progress: ProgressData & { isProcessing?: boolean }
  onCancel: () => void
  onOpenFolder: () => void
  outputPath: string | null
}

const ENCODER_ICONS: Record<string, string> = {
  'h264_nvenc': '⚡',
  'h264_qsv':  '⚡',
  'h264_amf':  '⚡',
  'libx264':   '🖥',
}

export function ProgressBar({ progress }: ProgressBarProps): React.ReactElement {
  const { percent = 0, stage = '', elapsed, total, eta, isProcessing, encoderLabel, encoderId } = progress

  const showEncoder = isProcessing && !!encoderLabel
  const isGpu = encoderId ? encoderId !== 'libx264' : false
  const icon = encoderId ? (ENCODER_ICONS[encoderId] ?? '🖥') : ''

  return (
    <div className="progress-container">
      <div className="progress-track">
        <div
          className={`progress-fill${isProcessing && percent < 5 ? ' indeterminate' : ''}`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="progress-info">
        <span className="progress-stage">
          {stage}
          {elapsed && total ? ` · ${elapsed} / ${total}` : ''}
          {eta ? <span className="progress-eta"> · осталось ~{eta}</span> : null}
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
