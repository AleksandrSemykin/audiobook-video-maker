import React from 'react'
import type { AppSettings, EncodingMode, Quality, Transition } from '../../../shared/types'

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

const QUALITY_OPTIONS: QualityOption[] = [
  { value: '1080p', label: '1080p', hint: 'YouTube HD' },
  { value: '720p',  label: '720p',  hint: 'Компактный' },
  { value: '480p',  label: '480p',  hint: 'Лёгкий' }
]

const TRANSITION_OPTIONS: TransitionOption[] = [
  { value: 'none', label: 'Без переходов' },
  { value: 'fade', label: 'Fade' }
]

const MODE_OPTIONS: ModeOption[] = [
  { value: 'max_quality', label: 'Макс. качество', hint: 'Лучше картинка, больше размер' },
  { value: 'min_size', label: 'Минимальный размер', hint: 'Меньше файл, быстрее запись' }
]

export function Settings({
  settings, onChange,
  videoName, onVideoNameChange,
  outputFolder, onSelectFolder,
  outputPath,
  disabled
}: SettingsProps): React.ReactElement {
  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void =>
    onChange({ ...settings, [key]: value })

  return (
    <div className="settings-panel">
      <div className="settings-grid">
        {/* Quality */}
        <div className="settings-row">
          <span className="settings-label">Качество видео:</span>
          <div className="radio-group">
            {QUALITY_OPTIONS.map(opt => (
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

        {/* Transitions */}
        <div className="settings-row">
          <span className="settings-label">Переходы:</span>
          <div className="radio-group">
            {TRANSITION_OPTIONS.map(opt => (
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

        {/* Encoding mode */}
        <div className="settings-row">
          <span className="settings-label">Режим:</span>
          <div className="radio-group">
            {MODE_OPTIONS.map(opt => (
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

        {/* Chapter titles toggle */}
        <div className="settings-row">
          <span className="settings-label">Названия глав:</span>
          <div
            className="toggle-wrapper"
            onClick={() => !disabled && set('showChapterTitles', !settings.showChapterTitles)}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            <div className={`toggle${settings.showChapterTitles ? ' on' : ''}`} />
            <span className="toggle-label">
              {settings.showChapterTitles ? 'Показывать' : 'Скрыть'}
            </span>
          </div>
        </div>

        {/* Video filename input */}
        <div className="settings-row settings-full">
          <span className="settings-label">Название файла:</span>
          <div className="output-path-row">
            <input
              type="text"
              className="output-path-input output-name-input"
              value={videoName}
              onChange={e => onVideoNameChange(e.target.value)}
              placeholder="Введите название видео..."
              disabled={disabled}
            />
            <span className="output-ext-label">.mp4</span>
          </div>
        </div>

        {/* Output folder */}
        <div className="settings-row settings-full">
          <span className="settings-label">Папка сохранения:</span>
          <div className="output-path-row">
            <div
              className="output-path-input"
              onClick={!disabled ? onSelectFolder : undefined}
              title={outputPath || 'Нажмите для выбора папки'}
              style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
            >
              {outputFolder ? (
                outputPath
              ) : (
                <span style={{ color: 'var(--muted)' }}>Выберите папку...</span>
              )}
            </div>
            <button
              className="btn btn-secondary btn-icon"
              onClick={onSelectFolder}
              disabled={disabled}
              title="Выбрать папку"
              style={{ width: 36, height: 36 }}
            >
              📁
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
