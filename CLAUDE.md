# puppeteer-capture — Project Guidelines

> A Puppeteer plugin for capturing page as a video with ultimate quality

## Project Overview

puppeteer-capture uses Chrome's `HeadlessExperimental` CDP domain to capture web pages as video in a deterministic way. Unlike screencast approaches, this produces frame-perfect, reproducible output.

**License**: MIT
**Node.js**: >=20.18

## Architecture

```
src/
├── index.ts                → Public API exports (capture, launch)
├── capture.ts              → capture() factory function
├── launch.ts               → launch() wrapper (enforces chrome-headless-shell)
├── PuppeteerCapture.ts     → Main class (delegates to implementation)
├── PuppeteerCaptureBase.ts → Base class (event emitter, lifecycle)
├── PuppeteerCaptureViaHeadlessExperimental.ts → CDP-based implementation
├── PuppeteerCaptureOptions.ts      → Capture options interface
├── PuppeteerCaptureStartOptions.ts → Start options interface
├── PuppeteerCaptureFormat.ts       → Output format enum
├── PuppeteerCaptureEvents.ts       → Event type definitions
├── MissingHeadlessExperimentalRequiredArgs.ts → Error class
└── NotChromeHeadlessShell.ts                  → Error class
```

**Key classes**:
- `PuppeteerCapture` — Main class, created via `capture(page, options?)`
- `PuppeteerCaptureViaHeadlessExperimental` — Implementation using CDP's `HeadlessExperimental.beginFrame`

**Dependencies**:
- `fluent-ffmpeg` — Video encoding
- `async-mutex` — Concurrency control for frame capture
- `which` — ffmpeg binary resolution
- `@ffmpeg-installer/ffmpeg` (optional) — Bundled ffmpeg fallback

## Build Commands

```bash
# Install dependencies
npm ci

# Build (compile TypeScript)
npm run build

# Run tests
npm run test

# Lint (ts-standard)
npm run lint
```

## Code Conventions

**Linting**: ts-standard (StandardJS + TypeScript)

**Naming**:

| Element | Convention | Example |
|---------|------------|---------|
| Files (classes) | PascalCase | `PuppeteerCapture.ts` |
| Files (functions) | camelCase | `capture.ts` |
| Classes | PascalCase | `PuppeteerCapture` |
| Functions | camelCase | `capture()`, `waitForTimeout()` |
| Constants | UPPER_SNAKE | — |

**Formatting** (editorconfig):
- JS/TS/JSON/YAML: 2-space indent
- Max line length: 120
- LF line endings, UTF-8, trailing newline

## Commit Message Format

Format: `(type) description`

Types: `feat`, `fix`, `imp`, `chore`, `docs`

Examples:
- `(imp) puppeteer v24.6.1`
- `(fix) detect closed connection`
- `(feat) GitHub Pages`
- `(chore) ci: codecov token`

Do **not** add issue numbers to commit messages. Use `Closes #N` in PR body instead.

## Testing

- **Framework**: Jest with ts-jest
- **Execution**: `npm run test` (runs with `--runInBand --coverage --detectOpenHandles --forceExit`)
- **Test files**: Co-located with source (`*.test.ts` in `src/`)
- **Slow test threshold**: 30s (tests involve browser launch)

**CI matrix**:
- OS: Ubuntu 24.04, Windows 2022
- Node: LTS iron, LTS jod

**Integration tests** (CI):
- Puppeteer versions: 24.3.0, 24.3.1, 24.4.0, 24.5.0, 24.6.0, 24.6.1
- Run after build job passes

## Release Process

1. Ensure `main` is green
2. Create GitHub Release (tag = version, e.g. `1.13.0`)
3. Publish workflow stamps version from tag and runs `npm publish`

**Required secrets**: `NPM_TOKEN`, `CODECOV_TOKEN`

## Platform Constraints

- **macOS not supported** — Chrome's HeadlessExperimental is not available on macOS
- **`--headless=new` not supported** — Plugin enforces `chrome-headless-shell` binary
- **Tests require ffmpeg** — Resolved via `FFMPEG` env var, `PATH`, or `@ffmpeg-installer/ffmpeg`

## Task Tracking

- **Issues**: https://github.com/alexey-pelykh/puppeteer-capture/issues
- **Closing issues**: Use `Closes #N` in PR description
