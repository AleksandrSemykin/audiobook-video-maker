import React from 'react'
import type { ProgressData } from '../../../shared/types'

interface ProgressBarProps {
  progress: ProgressData & { isProcessing?: boolean }
  onCancel: () => void
  onOpenFolder: () => void
  outputPath: string | null
}

export function ProgressBar({ progress }: ProgressBarProps): React.ReactElement {
  const { percent = 0, stage = '', elapsed, total, isProcessing } = progress

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
        </span>
        <span className="progress-percent">
          {isProcessing ? `${percent}%` : ''}
        </span>
      </div>
    </div>
  )
}
