# AudioBook Video Maker

Electron desktop app for converting audiobook chapters into MP4 videos.

## Distribution for users

Download binaries from GitHub Releases:

- Windows: `.exe` installer (`nsis`) or `.zip`
- macOS: `.dmg` (and `.zip`)
- Linux: `.AppImage`, `.deb`, `.tar.gz`

No Node.js install is required for end users.

## Build locally

```bash
npm ci
npm run build:win
npm run build:mac
npm run build:linux
```

Each command builds artifacts only for the current OS environment.

## Automatic Windows releases

Workflow file: `.github/workflows/release.yml`

How it works:

1. Create and push a version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

2. GitHub Actions builds only on `windows-latest`.
3. Build artifacts are uploaded to the GitHub Release for that tag.

## Free personal-use mode (Windows)

- Current workflow builds unsigned Windows artifacts (`.exe` and `.zip`).
- No GitHub secrets are required.
- Users may see SmartScreen warnings because the app is unsigned.
