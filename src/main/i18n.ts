import type { EncodingMode, Language } from '../shared/types'

interface MainDictionary {
  dialogs: {
    selectAudioFiles: string
    selectCover: string
    saveVideoAs: string
    selectOutputFolder: string
    audioFilterName: string
    imageFilterName: string
  }
  ffmpeg: {
    analyzingAudioFiles: string
    analyzingFile: (name: string) => string
    preparation: (audioPlanDescription: string, modeLabel: string, estimatedSize: string) => string
    audioCopy: string
    audioCopyConcat: string
    audioAac: (kbps: number) => string
    finalizing: (details: string) => string
    chapterProgress: (current: number, total: number) => string
    elapsedLabel: string
    sizeLabel: string
    writeLabel: string
    perSecond: string
  }
  encoding: {
    fallbackCodecLabel: string
    noReencode: (codecLabel: string) => string
    noReencodeConcat: (codecLabel: string) => string
    aacBitrate: (kbps: number) => string
  }
  modeLabels: Record<EncodingMode, string>
  wallTime: {
    hour: string
    minute: string
    second: string
  }
}

const MAIN_DICTIONARY: Record<Language, MainDictionary> = {
  ru: {
    dialogs: {
      selectAudioFiles: 'Выберите аудиофайлы',
      selectCover: 'Выберите обложку',
      saveVideoAs: 'Сохранить видео как...',
      selectOutputFolder: 'Выберите папку для сохранения видео',
      audioFilterName: 'Аудио',
      imageFilterName: 'Изображения'
    },
    ffmpeg: {
      analyzingAudioFiles: 'Анализ аудиофайлов...',
      analyzingFile: (name) => `Анализ: ${name}`,
      preparation: (audioPlanDescription, modeLabel, estimatedSize) =>
        `Подготовка: ${audioPlanDescription} · ${modeLabel} · ожидаемый размер ~${estimatedSize}`,
      audioCopy: 'звук без перекодирования',
      audioCopyConcat: 'звук без перекодирования (concat)',
      audioAac: (kbps) => `звук AAC ${kbps} кбит/с`,
      finalizing: (details) => `FFmpeg завершает контейнер MP4: ${details}`,
      chapterProgress: (current, total) => `Глава ${current} из ${total}`,
      elapsedLabel: 'прошло',
      sizeLabel: 'размер',
      writeLabel: 'запись',
      perSecond: '/с'
    },
    encoding: {
      fallbackCodecLabel: 'аудио',
      noReencode: (codecLabel) => `Без перекодирования (${codecLabel})`,
      noReencodeConcat: (codecLabel) => `Без перекодирования (${codecLabel}, concat)`,
      aacBitrate: (kbps) => `AAC ${kbps} кбит/с`
    },
    modeLabels: {
      max_quality: 'режим: макс. качество',
      min_size: 'режим: минимальный размер'
    },
    wallTime: {
      hour: 'ч',
      minute: 'мин',
      second: 'с'
    }
  },
  en: {
    dialogs: {
      selectAudioFiles: 'Select audio files',
      selectCover: 'Select cover image',
      saveVideoAs: 'Save video as...',
      selectOutputFolder: 'Select output folder',
      audioFilterName: 'Audio',
      imageFilterName: 'Images'
    },
    ffmpeg: {
      analyzingAudioFiles: 'Analyzing audio files...',
      analyzingFile: (name) => `Analyzing: ${name}`,
      preparation: (audioPlanDescription, modeLabel, estimatedSize) =>
        `Preparing: ${audioPlanDescription} · ${modeLabel} · estimated size ~${estimatedSize}`,
      audioCopy: 'audio stream copy',
      audioCopyConcat: 'audio stream copy (concat)',
      audioAac: (kbps) => `audio AAC ${kbps} kbps`,
      finalizing: (details) => `FFmpeg finalizing MP4 container: ${details}`,
      chapterProgress: (current, total) => `Chapter ${current} of ${total}`,
      elapsedLabel: 'elapsed',
      sizeLabel: 'size',
      writeLabel: 'write',
      perSecond: '/s'
    },
    encoding: {
      fallbackCodecLabel: 'audio',
      noReencode: (codecLabel) => `No re-encoding (${codecLabel})`,
      noReencodeConcat: (codecLabel) => `No re-encoding (${codecLabel}, concat)`,
      aacBitrate: (kbps) => `AAC ${kbps} kbps`
    },
    modeLabels: {
      max_quality: 'mode: max quality',
      min_size: 'mode: minimum size'
    },
    wallTime: {
      hour: 'h',
      minute: 'min',
      second: 's'
    }
  }
}

function getDictionary(language: Language): MainDictionary {
  return MAIN_DICTIONARY[language] ?? MAIN_DICTIONARY.ru
}

export function getMainDialogs(language: Language): MainDictionary['dialogs'] {
  return getDictionary(language).dialogs
}

export function getMainFfmpeg(language: Language): MainDictionary['ffmpeg'] {
  return getDictionary(language).ffmpeg
}

export function getEncodingTexts(language: Language): MainDictionary['encoding'] {
  return getDictionary(language).encoding
}

export function getModeLabel(mode: EncodingMode, language: Language): string {
  return getDictionary(language).modeLabels[mode]
}

export function formatWallTimeLocalized(seconds: number, language: Language): string {
  const units = getDictionary(language).wallTime
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) return `${h} ${units.hour} ${String(m).padStart(2, '0')} ${units.minute}`
  if (m > 0) return `${m} ${units.minute} ${String(s).padStart(2, '0')} ${units.second}`
  return `${s} ${units.second}`
}
