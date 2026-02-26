# Plan: AudioBook Video Maker — Electron App

## Context

Нужно универсальное десктопное приложение для создания MP4-видео из аудиокниг.
Пользователь выбирает MP3-файлы + обложку → ffmpeg собирает один видеофайл.
Используется для регулярного выпуска аудиокниг в видеоформате (YouTube и др.).

**Расположение проекта:** `C:\Users\Alex\OneDrive\Documents\Programming\Projects\audiobook-video-maker\`
**Файл плана внутри проекта:** `PLAN.md` (копируется в корень проекта при создании)

---

## Tech Stack

| Компонент | Решение |
|-----------|---------|
| Framework | Electron.js (через **electron-vite** scaffold) |
| UI | **React 18** + Vite |
| Drag & Drop | **@dnd-kit/core** + **@dnd-kit/sortable** |
| FFmpeg | **ffmpeg-static** + **ffprobe-static** (бандл внутри приложения) |
| FFmpeg wrapper | **fluent-ffmpeg** |
| Стили | CSS-переменные (custom dark theme, без UI-фреймворка) |
| Сборка | **electron-builder** |

### ✅ Встроенный FFmpeg (не нужна установка пользователем)

Используем `ffmpeg-static` и `ffprobe-static` — npm-пакеты, которые содержат
готовые бинарники ffmpeg/ffprobe для Windows/Mac/Linux.

При сборке через electron-builder бинарники выносятся из `app.asar` в
`app.asar.unpacked` (через `asarUnpack`), чтобы к ним можно было обращаться как
к исполняемым файлам.

```js
// src/main/ffmpeg.js — определение пути
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';
import ffmpeg from 'fluent-ffmpeg';

// В packaged-приложении бинарь вне asar
const resolveBin = (p) => p.replace('app.asar', 'app.asar.unpacked');

ffmpeg.setFfmpegPath(app.isPackaged ? resolveBin(ffmpegPath) : ffmpegPath);
ffmpeg.setFfprobePath(app.isPackaged ? resolveBin(ffprobePath.path) : ffprobePath.path);
```

electron-builder.yml:
```yaml
asarUnpack:
  - node_modules/ffmpeg-static/**
  - node_modules/ffprobe-static/**
```

---

## Структура проекта

```
audiobook-video-maker/
├── PLAN.md                    ← этот план (сохранён внутри проекта)
├── package.json
├── electron.vite.config.mjs
├── electron-builder.yml
├── src/
│   ├── main/
│   │   ├── index.js          ← главный процесс Electron (window, IPC, диалоги)
│   │   └── ffmpeg.js         ← вся логика FFmpeg + ffprobe (IPC handlers)
│   ├── preload/
│   │   └── index.js          ← contextBridge: window.electronAPI
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── main.jsx
│           ├── App.jsx        ← корневой компонент, state
│           ├── App.css        ← тема, переменные, layout
│           └── components/
│               ├── CoverPicker.jsx   ← drag&drop/click для обложки
│               ├── AudioList.jsx     ← список файлов + DnD-сортировка
│               ├── AudioItem.jsx     ← один файл в списке (handle + remove)
│               ├── Settings.jsx      ← качество, переходы, глав. заголовки, путь
│               ├── ProgressBar.jsx   ← прогресс + статус + кнопка отмены
│               └── Toast.jsx         ← всплывающие уведомления
└── resources/
    └── icon.png
```

---

## Дизайн / UI

**Тема:** тёмная, профессиональная (как DaVinci Resolve / Audacity)

```css
--bg:         #0f1117   /* основной фон */
--surface:    #1a1d27   /* панели */
--card:       #212436   /* карточки */
--border:     #2d3148   /* границы */
--primary:    #7c6af7   /* фиолетовый акцент */
--primary-h:  #9d8fff   /* hover */
--pink:       #f472b6   /* вторичный акцент */
--success:    #34d399
--danger:     #f87171
--text:       #e2e8f0
--muted:      #64748b
```

**Layout (900×640 min):**
```
┌─────────────────────────────────────────────────┐
│  🎵 AudioBook Video Maker          [_][□][X]    │
├──────────────┬──────────────────────────────────┤
│  ОБЛОЖКА     │  АУДИОФАЙЛЫ                  [+] │
│              │  ─────────────────────────────   │
│  [preview]   │  ⠿ 01. Пробуждение от сна   [✕]  │
│              │  ⠿ 02. Признание иллюзий    [✕]  │
│  [выбрать]   │  ⠿ 03. Принятие дуальности [✕]  │
│              │  ─────────────────────────────   │
│              │  11 файлов · ~14 ч 22 мин         │
├──────────────┴──────────────────────────────────┤
│ НАСТРОЙКИ                                       │
│ Качество:  [● 1080p]  [○ 720p]  [○ 480p]       │
│ Переходы:  [● Нет]    [○ Fade между главами]    │
│ Названия глав: [toggle OFF/ON]                  │
│ Выходной файл: [/path/to/output.mp4]     [...]  │
├─────────────────────────────────────────────────┤
│  [██████████████░░░░░░] 65%  Глава 7 из 11...   │
│                           [Отмена] [▶ Создать]  │
└─────────────────────────────────────────────────┘
```

---

## IPC API (preload → main)

```js
// renderer вызывает:
window.electronAPI.openAudioFiles()       → string[]  (пути к MP3)
window.electronAPI.openImageFile()        → string    (путь к обложке)
window.electronAPI.saveOutputFile(name)   → string    (путь для .mp4)
window.electronAPI.openFolder(path)       → void
window.electronAPI.getAudioDuration(path) → number    (секунды, через ffprobe)
window.electronAPI.startProcessing(cfg)   → void
window.electronAPI.cancelProcessing()     → void

// main → renderer (события):
window.electronAPI.onProgress(cb)   // { percent, currentChapter, totalChapters, stage }
window.electronAPI.onComplete(cb)   // { outputPath }
window.electronAPI.onError(cb)      // { message }
```

---

## FFmpeg логика (src/main/ffmpeg.js)

### Режим Simple (статичная обложка, без переходов):
```bash
ffmpeg -loop 1 -i cover.jpg \
  -i audio1.mp3 -i audio2.mp3 ... -i audioN.mp3 \
  -filter_complex "
    [1:a][2:a]...concat=n=N:v=0:a=1[a];
    [0:v]scale=1920:1080:force_original_aspect_ratio=decrease,
         pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v]
  " \
  -map "[v]" -map "[a]" \
  -c:v libx264 -preset slow -crf 18 \
  -c:a aac -b:a 192k -movflags +faststart -shortest \
  output.mp4
```

### Режим с названиями глав:
1. `ffprobe` получает длительность каждого MP3 → рассчитываем timestamps
2. Строим `drawtext` фильтры для каждой главы с `enable='between(t, start, end)'`
3. Шрифт: белый, тень, верх экрана, показывается первые 5 сек главы

### Качество:
| Пресет | Разрешение | CRF | Preset |
|--------|------------|-----|--------|
| 1080p  | 1920×1080  | 18  | slow   |
| 720p   | 1280×720   | 22  | medium |
| 480p   | 854×480    | 26  | fast   |

### Прогресс:
fluent-ffmpeg эмитит `progress` → парсим `timemark` → % от общей длительности → IPC event

---

## Автосортировка файлов

```js
const getFileOrder = (name) => {
  const m = name.match(/^(\d+)[.\s_\-]?/);
  return m ? parseInt(m[1], 10) : 999;
};
files.sort((a, b) => getFileOrder(a.name) - getFileOrder(b.name));
```

---

## npm зависимости

```bash
# scaffold
npm create @quick-start/electron@latest audiobook-video-maker -- --template react

# runtime (bundled ffmpeg — не нужна установка пользователем!)
npm install fluent-ffmpeg ffmpeg-static ffprobe-static
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# dev
npm install -D electron-builder
```

---

## Порядок реализации

1. **Scaffold** проекта electron-vite + React, установка зависимостей
2. **PLAN.md** — сохранить план внутри проекта
3. **electron-builder.yml**: конфиг сборки с `asarUnpack` для ffmpeg/ffprobe
4. **Main process** (`src/main/index.js`): окно, меню, настройки безопасности
5. **FFmpeg module** (`src/main/ffmpeg.js`): резолвинг бинарей + все IPC handlers
6. **Preload** (`src/preload/index.js`): contextBridge с полным API
7. **Глобальные стили** (`App.css`): CSS-переменные, сброс, layout
8. **App.jsx**: state management, layout skeleton
9. **CoverPicker**: drag&drop зона + превью изображения
10. **AudioList + AudioItem**: список с DnD-сортировкой (@dnd-kit)
11. **Settings**: качество (радио), переходы (радио), toggle для глав, output path
12. **ProgressBar**: анимация, статус, кнопка отмены
13. **Toast**: уведомления (успех/ошибка)
14. **Финальная интеграция** и тест с реальными файлами

---

## Проверка результата

1. `npm run dev` → открывается окно приложения
2. Выбрать MP3 из `Роман Егоров/Сон пробуждённого/Аудио/`
3. Выбрать обложку `photo_2026-02-09_23-37-52.jpg`
4. Проверить автосортировку (01, 02, ..., 11)
5. Перетащить файлы — проверить DnD
6. Создать видео → прогресс-бар + готовый MP4
7. Проверить режим с названиями глав — текст на видео
8. `npm run build` → .exe инсталлятор без требований к установке FFmpeg
