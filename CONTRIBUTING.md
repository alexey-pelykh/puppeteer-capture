# Contributing to puppeteer-capture

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

1. Fork and clone the repo
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm run test
   ```
5. Check code style:
   ```bash
   npm run lint
   ```

## Prerequisites

- **Node.js** >=20.18
- **ffmpeg** — resolved via `FFMPEG` env var, `PATH`, or the optional `@ffmpeg-installer/ffmpeg` package

## Platform Constraints

- Chrome's `HeadlessExperimental` is **not available on macOS** — tests must run on Linux or Windows
- The plugin enforces the `chrome-headless-shell` binary; `--headless=new` is not supported
- CI runs on Ubuntu 24.04 and Windows 2022

## Code Conventions

- **Linter**: `ts-standard` (StandardJS + TypeScript)
- **File naming**: PascalCase for classes (`PuppeteerCapture.ts`), camelCase for functions (`capture.ts`)
- **Formatting**: 2-space indent for JS/TS/JSON/YAML, max line length 120, LF endings, UTF-8, trailing newline (see [`.editorconfig`](.editorconfig))

## Commit Message Format

- **Format**: `(type) description`
- **Types**: `feat`, `fix`, `imp`, `chore`, `docs`
- **Examples**: `(feat) add mp4 output format`, `(fix) detect closed connection`
- Do **not** add issue numbers to commit messages — use `Closes #N` in PR body instead

## Pull Requests

- Create a branch from `main`
- Ensure `npm run lint` and `npm run test` pass
- One logical change per PR
- Reference related issues with `Closes #N` in PR description

## Testing

- **Framework**: Jest with ts-jest
- **Test files**: co-located with source (`*.test.ts` in `src/`)
- **Run**: `npm run test` (runs with `--runInBand --coverage --detectOpenHandles --forceExit`)
- Tests involve browser launch, so they are slow (~30s threshold)

## Reporting Issues

Please use the [issue tracker](https://github.com/alexey-pelykh/puppeteer-capture/issues) to report bugs or request features.
