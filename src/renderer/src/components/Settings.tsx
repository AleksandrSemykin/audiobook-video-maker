import React from 'react'
import type { AppSettings, EncodingMode, Quality, Transition, UploadTarget } from '../../../shared/types'
import { getRendererTexts } from '../i18n'

interface QualityOption {
  value: Quality
  label: string
  hint: string
}

interface TransitionOption {
  value: Transition
  label: string
}

interface ModeOption {
  value: EncodingMode
  label: string
  hint: string
}

interface UploadTargetOption {
  value: UploadTarget
  label: string
  hint: string
}

interface SettingsProps {
  settings: AppSettings
  onChange: (settings: AppSettings) => void
  videoName: string
  onVideoNameChange: (name: string) => void
  outputFolder: string
  onSelectFolder: () => void
  outputPath: string
  disabled?: boolean
}

export function Settings({
  settings, onChange,
  videoName, onVideoNameChange,
  outputFolder, onSelectFolder,
  outputPath,
  disabled
}: SettingsProps): React.ReactElement {
  const t = getRendererTexts(settings.language)

  const qualityOptions: QualityOption[] = [
    { value: '1080p', label: '1080p', hint: t.options.qualityHints['1080p'] },
    { value: '720p', label: '720p', hint: t.options.qualityHints['720p'] },
    { value: '480p', label: '480p', hint: t.options.qualityHints['480p'] }
  ]

  const transitionOptions: TransitionOption[] = [
    { value: 'none', label: t.options.transitions.none },
    { value: 'fade', label: t.options.transitions.fade }
  ]

  const modeOptions: ModeOption[] = [
    {
      value: 'max_quality',
      label: t.options.modeLabels.max_quality,
      hint: t.options.modeHints.max_quality
    },
    {
      value: 'min_size',
      label: t.options.modeLabels.min_size,
      hint: t.options.modeHints.min_size
    }
  ]

  const uploadTargetOptions: UploadTargetOption[] = [
    {
      value: 'universal',
      label: t.options.uploadTargets.universal,
      hint: t.options.uploadTargetHints.universal
    },
    {
      value: 'youtube_fast',
      label: t.options.uploadTargets.youtube_fast,
      hint: t.options.uploadTargetHints.youtube_fast
    }
  ]

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="settings-panel">
      <div className="settings-grid">
        <div className="settings-row">
          <span className="settings-label">{t.settings.qualityLabel}</span>
          <div className="radio-group">
            {qualityOptions.map(opt => (
              <label
                key={opt.value}
                className={`radio-option${settings.quality === opt.value ? ' active' : ''}`}
                title={opt.hint}
              >
                <input
                  type="radio"
                  name="quality"
                  value={opt.value}
                  checked={settings.quality === opt.value}
                  onChange={() => set('quality', opt.value)}
                  disabled={disabled}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t.settings.transitionsLabel}</span>
          <div className="radio-group">
            {transitionOptions.map(opt => (
              <label
                key={opt.value}
                className={`radio-option${settings.transitions === opt.value ? ' active' : ''}`}
              >
                <input
                  type="radio"
                  name="transitions"
                  value={opt.value}
                  checked={settings.transitions === opt.value}
                  onChange={() => set('transitions', opt.value)}
                  disabled={disabled}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t.settings.modeLabel}</span>
          <div className="radio-group">
            {modeOptions.map(opt => (
              <label
                key={opt.value}
                className={`radio-option${settings.encodingMode === opt.value ? ' active' : ''}`}
                title={opt.hint}
              >
                <input
                  type="radio"
                  name="encodingMode"
                  value={opt.value}
                  checked={settings.encodingMode === opt.value}
                  onChange={() => set('encodingMode', opt.value)}
                  disabled={disabled}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="settings-row settings-full settings-block-row">
          <span className="settings-label">{t.settings.uploadTargetLabel}</span>
          <div className="settings-stack">
            <div className="radio-group">
              {uploadTargetOptions.map(opt => (
                <label
                  key={opt.value}
                  className={`radio-option${settings.uploadTarget === opt.value ? ' active' : ''}`}
                  title={opt.hint}
                >
                  <input
                    type="radio"
                    name="uploadTarget"
                    value={opt.value}
                    checked={settings.uploadTarget === opt.value}
                    onChange={() => set('uploadTarget', opt.value)}
                    disabled={disabled}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {settings.uploadTarget === 'youtube_fast' && (
              <div className="settings-warning" role="note">
                ⚠️ {t.settings.youtubeFastWarning}
              </div>
            )}
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">{t.settings.chapterTitlesLabel}</span>
          <div
            className={`toggle-wrapper${disabled ? ' is-disabled' : ''}`}
            onClick={() => !disabled && set('showChapterTitles', !settings.showChapterTitles)}
          >
            <div className={`toggle${settings.showChapterTitles ? ' on' : ''}`} />
            <span className="toggle-label">
              {settings.showChapterTitles ? t.settings.showChapterTitles : t.settings.hideChapterTitles}
            </span>
          </div>
        </div>

        <div className="settings-row settings-full">
          <span className="settings-label">{t.settings.fileNameLabel}</span>
          <div className="output-path-row">
            <input
              type="text"
              className="output-path-input output-name-input"
              value={videoName}
              onChange={e => onVideoNameChange(e.target.value)}
              placeholder={t.settings.fileNamePlaceholder}
              disabled={disabled}
            />
            <span className="output-ext-label">.mp4</span>
          </div>
        </div>

        <div className="settings-row settings-full">
          <span className="settings-label">{t.settings.outputFolderLabel}</span>
          <div className="output-path-row">
            <div
              className={`output-path-input${disabled ? ' is-disabled' : ''}`}
              onClick={!disabled ? onSelectFolder : undefined}
              title={outputPath || t.settings.outputFolderTitle}
            >
              {outputFolder ? (
                outputPath
              ) : (
                <span className="output-path-placeholder">{t.settings.outputFolderPlaceholder}</span>
              )}
            </div>
            <button
              className="btn btn-secondary btn-icon"
              onClick={onSelectFolder}
              disabled={disabled}
              title={t.settings.chooseFolderTitle}
            >
              📁
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
