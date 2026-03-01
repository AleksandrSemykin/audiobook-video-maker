# AudioBook Video Maker

Electron desktop app for converting audiobook chapters into MP4 videos.

## Distribution for users

Download binaries from GitHub Releases:

- Windows: `.exe` installer (`nsis`) or `.zip`
- macOS/Linux: no official CI release yet (build locally on target OS)

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
- CI uses `--publish never` during build, then uploads assets in a separate release step.

## In-app auto updates (Windows)

- The app checks for updates automatically after launch, then every 30 minutes.
- If a new version is found, it downloads in background and shows a notification.
- When download is complete, the user can choose:
  - install now (app restarts with new version),
  - install later.
- To disable update checks (for local testing), set environment variable:

```bash
ABVM_DISABLE_AUTO_UPDATE=1
```

## License

This project is licensed under **GNU GPL v3 or later**.

See:

- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
