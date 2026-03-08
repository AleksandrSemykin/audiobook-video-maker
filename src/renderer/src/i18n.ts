import type { EncodingMode, Language, Quality, Transition, UploadTarget } from '../../shared/types'

interface RendererDictionary {
  app: {
    doneStage: string
    cancelled: string
    ffmpegErrorPrefix: string
    chooseCoverWarning: string
    addAudioWarning: string
    chooseOutputWarning: string
    initStage: string
    videoSaved: (fileName: string) => string
    videoCreated: string
    openFolder: string
    cancel: string
    createVideo: string
    titleChooseCover: string
    titleAddAudio: string
    titleChooseOutput: string
    switchLanguage: string
    updateAvailable: (version: string) => string
    updateDownloading: (percent: number) => string
    updateDownloaded: (version: string) => string
    updateErrorPrefix: string
  }
  progress: {
    etaPrefix: string
  }
  settings: {
    qualityLabel: string
    transitionsLabel: string
    modeLabel: string
    uploadTargetLabel: string
    chapterTitlesLabel: string
    showChapterTitles: string
    hideChapterTitles: string
    fileNameLabel: string
    fileNamePlaceholder: string
    outputFolderLabel: string
    outputFolderTitle: string
    outputFolderPlaceholder: string
    chooseFolderTitle: string
    languageLabel: string
    youtubeFastWarning: string
  }
  options: {
    qualityHints: Record<Quality, string>
    transitions: Record<Transition, string>
    modeLabels: Record<EncodingMode, string>
    modeHints: Record<EncodingMode, string>
    uploadTargets: Record<UploadTarget, string>
    uploadTargetHints: Record<UploadTarget, string>
    languages: Record<Language, string>
  }
  audioList: {
    panelLabel: string
    addFilesTitle: string
    emptyText: string
    clear: string
    filesCount: (count: number) => string
  }
  coverPicker: {
    panelLabel: string
    chooseCoverTitle: string
    replace: string
    emptyText: string
    supportedFormats: string
    clear: string
    altCover: string
  }
  audioItem: {
    reorderTitle: string
    removeTitle: string
  }
  units: {
    hour: string
    minute: string
    second: string
  }
}

const UI_TEXTS: Record<Language, RendererDictionary> = {
  ru: {
    app: {
      doneStage: 'Готово! 🎉',
      cancelled: 'Создание видео отменено',
      ffmpegErrorPrefix: 'Ошибка FFmpeg',
      chooseCoverWarning: 'Выберите обложку для видео',
      addAudioWarning: 'Добавьте хотя бы один аудиофайл',
      chooseOutputWarning: 'Укажите путь для сохранения видео',
      initStage: 'Инициализация...',
      videoSaved: (fileName) => `Видео сохранено: ${fileName}`,
      videoCreated: 'Видео создано:',
      openFolder: '📂 Открыть',
      cancel: '⏹ Отмена',
      createVideo: '▶ Создать видео',
      titleChooseCover: 'Выберите обложку',
      titleAddAudio: 'Добавьте аудиофайлы',
      titleChooseOutput: 'Выберите путь сохранения',
      switchLanguage: 'Сменить язык',
      updateAvailable: (version) => `Доступна новая версия ${version}. Загружаю обновление...`,
      updateDownloading: (percent) => `Загрузка обновления: ${percent}%`,
      updateDownloaded: (version) => `Обновление ${version} готово к установке`,
      updateErrorPrefix: 'Не удалось проверить обновления'
    },
    progress: {
      etaPrefix: 'осталось ~'
    },
    settings: {
      qualityLabel: 'Качество видео:',
      transitionsLabel: 'Переходы:',
      modeLabel: 'Режим:',
      uploadTargetLabel: 'Совместимость:',
      chapterTitlesLabel: 'Названия глав:',
      showChapterTitles: 'Показывать',
      hideChapterTitles: 'Скрыть',
      fileNameLabel: 'Название файла:',
      fileNamePlaceholder: 'Введите название видео...',
      outputFolderLabel: 'Папка сохранения:',
      outputFolderTitle: 'Нажмите для выбора папки',
      outputFolderPlaceholder: 'Выберите папку...',
      chooseFolderTitle: 'Выбрать папку',
      languageLabel: 'Язык:',
      youtubeFastWarning: 'Быстрый режим рассчитан на YouTube. Для RuTube загрузка может не сработать.'
    },
    options: {
      qualityHints: {
        '1080p': 'YouTube HD',
        '720p': 'Компактный',
        '480p': 'Лёгкий'
      },
      transitions: {
        none: 'Без переходов',
        fade: 'Fade'
      },
      modeLabels: {
        max_quality: 'Макс. качество',
        min_size: 'Минимальный размер'
      },
      modeHints: {
        max_quality: 'Лучше картинка, больше размер',
        min_size: 'Меньше файл, быстрее запись'
      },
      uploadTargets: {
        universal: 'RuTube + YouTube',
        youtube_fast: 'Быстро для YouTube'
      },
      uploadTargetHints: {
        universal: 'Максимальная совместимость с RuTube и YouTube',
        youtube_fast: 'Старый быстрый режим. Может не загружаться в RuTube'
      },
      languages: {
        ru: 'Русский',
        en: 'English'
      }
    },
    audioList: {
      panelLabel: 'Аудиофайлы',
      addFilesTitle: 'Добавить файлы',
      emptyText: 'Нажмите «+» или перетащите\nMP3-файлы из проводника',
      clear: 'Очистить',
      filesCount: (count) => {
        if (count === 1) return `${count} файл`
        if (count < 5) return `${count} файла`
        return `${count} файлов`
      }
    },
    coverPicker: {
      panelLabel: 'Обложка',
      chooseCoverTitle: 'Выбрать обложку',
      replace: 'Заменить',
      emptyText: 'Перетащите обложку\nили нажмите для выбора',
      supportedFormats: 'Форматы: JPG, JPEG, PNG, WEBP, BMP, GIF',
      clear: 'Очистить',
      altCover: 'Обложка'
    },
    audioItem: {
      reorderTitle: 'Перетащите для изменения порядка',
      removeTitle: 'Удалить'
    },
    units: {
      hour: 'ч',
      minute: 'мин',
      second: 'сек'
    }
  },
  en: {
    app: {
      doneStage: 'Done! 🎉',
      cancelled: 'Video creation cancelled',
      ffmpegErrorPrefix: 'FFmpeg error',
      chooseCoverWarning: 'Select a cover image',
      addAudioWarning: 'Add at least one audio file',
      chooseOutputWarning: 'Specify output path',
      initStage: 'Initializing...',
      videoSaved: (fileName) => `Video saved: ${fileName}`,
      videoCreated: 'Video created:',
      openFolder: '📂 Open',
      cancel: '⏹ Cancel',
      createVideo: '▶ Create video',
      titleChooseCover: 'Select cover image',
      titleAddAudio: 'Add audio files',
      titleChooseOutput: 'Choose output path',
      switchLanguage: 'Switch language',
      updateAvailable: (version) => `Version ${version} is available. Downloading update...`,
      updateDownloading: (percent) => `Downloading update: ${percent}%`,
      updateDownloaded: (version) => `Update ${version} is ready to install`,
      updateErrorPrefix: 'Failed to check updates'
    },
    progress: {
      etaPrefix: 'remaining ~'
    },
    settings: {
      qualityLabel: 'Video quality:',
      transitionsLabel: 'Transitions:',
      modeLabel: 'Mode:',
      uploadTargetLabel: 'Compatibility:',
      chapterTitlesLabel: 'Chapter titles:',
      showChapterTitles: 'Show',
      hideChapterTitles: 'Hide',
      fileNameLabel: 'File name:',
      fileNamePlaceholder: 'Enter video name...',
      outputFolderLabel: 'Output folder:',
      outputFolderTitle: 'Click to choose folder',
      outputFolderPlaceholder: 'Choose folder...',
      chooseFolderTitle: 'Choose folder',
      languageLabel: 'Language:',
      youtubeFastWarning: 'Fast mode is intended for YouTube. RuTube upload may fail.'
    },
    options: {
      qualityHints: {
        '1080p': 'YouTube HD',
        '720p': 'Compact',
        '480p': 'Light'
      },
      transitions: {
        none: 'No transitions',
        fade: 'Fade'
      },
      modeLabels: {
        max_quality: 'Max quality',
        min_size: 'Minimum size'
      },
      modeHints: {
        max_quality: 'Better image, larger size',
        min_size: 'Smaller file, faster write'
      },
      uploadTargets: {
        universal: 'RuTube + YouTube',
        youtube_fast: 'Fast for YouTube'
      },
      uploadTargetHints: {
        universal: 'Maximum compatibility with RuTube and YouTube',
        youtube_fast: 'Legacy fast mode. RuTube upload may fail'
      },
      languages: {
        ru: 'Russian',
        en: 'English'
      }
    },
    audioList: {
      panelLabel: 'Audio files',
      addFilesTitle: 'Add files',
      emptyText: 'Click "+" or drag and drop\nMP3 files from Explorer',
      clear: 'Clear',
      filesCount: (count) => `${count} ${count === 1 ? 'file' : 'files'}`
    },
    coverPicker: {
      panelLabel: 'Cover',
      chooseCoverTitle: 'Choose cover',
      replace: 'Replace',
      emptyText: 'Drag and drop cover image\nor click to choose',
      supportedFormats: 'Formats: JPG, JPEG, PNG, WEBP, BMP, GIF',
      clear: 'Clear',
      altCover: 'Cover'
    },
    audioItem: {
      reorderTitle: 'Drag to reorder',
      removeTitle: 'Remove'
    },
    units: {
      hour: 'h',
      minute: 'min',
      second: 'sec'
    }
  }
}

export function getRendererTexts(language: Language): RendererDictionary {
  return UI_TEXTS[language] ?? UI_TEXTS.ru
}

export function formatAudioDuration(totalSeconds: number, language: Language): string | null {
  if (totalSeconds <= 0) return null
  const units = getRendererTexts(language).units
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h} ${units.hour} ${m} ${units.minute}`
  if (m > 0) return `${m} ${units.minute} ${s} ${units.second}`
  return `${s} ${units.second}`
}
