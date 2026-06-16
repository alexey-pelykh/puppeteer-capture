# puppeteer-capture — Project Guidelines

> A Puppeteer plugin for capturing page as a video with ultimate quality

## Project Overview

puppeteer-capture uses Chrome's `HeadlessExperimental` CDP domain to capture web pages as video in a deterministic way. Unlike screencast approaches, this produces frame-perfect, reproducible output.

**License**: MIT
**Node.js**: >=22.12

## Architecture

```
src/
├── index.ts                → Public API exports (capture, launch)
├── capture.ts              → capture() factory function
├── launch.ts               → launch() wrapper (enforces chrome-headless-shell)
├── PuppeteerCapture.ts     → Main interface (public API contract)
├── PuppeteerCaptureBase.ts → Base class (event emitter, lifecycle)
├── PuppeteerCaptureViaHeadlessExperimental.ts → CDP-based implementation
├── PuppeteerCaptureOptions.ts      → Capture options interface
├── PuppeteerCaptureStartOptions.ts → Start options interface
├── PuppeteerCaptureFormat.ts       → Output format factory functions
├── PuppeteerCaptureEvents.ts       → Event type definitions
├── MissingHeadlessExperimentalRequiredArgs.ts → Error class
└── NotChromeHeadlessShell.ts                  → Error class
```

**Key classes**:
- `PuppeteerCapture` — Main interface, created via `capture(page, options?)`
- `PuppeteerCaptureViaHeadlessExperimental` — Implementation using CDP's `HeadlessExperimental.beginFrame`

**Dependencies**:
- `fluent-ffmpeg` — Video encoding
- `async-mutex` — Concurrency control for frame capture
- `which` — ffmpeg binary resolution
- `ffmpeg-static` (optional) — Bundled ffmpeg fallback

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
- Puppeteer versions: latest patch of each supported (major, minor), 24.3 → 25.1, on Ubuntu + Windows (one entry per minor)
- Browser provisioning: the `npm install --no-save puppeteer@<v>` swap runs with `PUPPETEER_SKIP_DOWNLOAD=true` — its 24.x postinstall otherwise leaves a partial cache folder for `<v>`'s pinned build that blocks re-download (`@puppeteer/browsers` has no `--force`). Browsers are then provisioned via `npx @puppeteer/browsers@latest install chrome@<build>` + `chrome-headless-shell@<build>` at `<v>`'s pinned build: puppeteer 24.x's own bundled `@puppeteer/browsers` (2.13.2) downloads but silently fails to extract Chrome on the runners (exit 0, no executable), whereas the current 3.x extracts correctly (it is what the 25.x base uses). A verification step fails the job if the executables are missing. No per-version browser cache.
- Run after build job passes

## Release Process

1. Ensure `main` is green
2. Create GitHub Release (tag = semver version, e.g. `1.13.0`)
3. Publish workflow validates tag, runs lint + test, then publishes with provenance

**Release notes format** (use GitHub's "Generate release notes" style):

```markdown
## What's Changed
* (type) description by @author in https://github.com/alexey-pelykh/puppeteer-capture/pull/N

**Full Changelog**: https://github.com/alexey-pelykh/puppeteer-capture/compare/PREV_TAG...NEW_TAG
```

**Publishing**: Uses OIDC trusted publishing (no `NPM_TOKEN`). The `npm-publish` GitHub environment
provides deployment protection. Provenance attestation links the published package to its source commit.

**Required secrets**: `CODECOV_TOKEN`

**Required environments**: `npm-publish` (with deployment protection rules)

## Platform Constraints

- **macOS not supported** — Chrome's HeadlessExperimental is not available on macOS
- **`--headless=new` not supported** — Plugin enforces `chrome-headless-shell` binary
- **Tests require ffmpeg** — Resolved via `FFMPEG` env var, `PATH`, or `ffmpeg-static`

## Puppeteer Version Bump Procedure

When a new puppeteer version is released, a single atomic commit updates 4 files.

**One (major, minor) at a time**: When multiple (major, minor) combos are pending (e.g. 24.43 → 25.1),
bump one per commit+release. Never skip intermediates (24.43 → 25.0 → 25.1, not 24.43 → 25.1).
Exhaust all pending minors of the current major before crossing into the next major. Each
(major, minor) gets its own commit, push, and npm release before proceeding to the next.

**Commit message**: `(imp) puppeteer v{VERSION}`

### 1. `package.json`

- **`devDependencies`**: Pin both `puppeteer` and `puppeteer-core` to exact new version (no caret)
- **`peerDependencies`**: Append `|| ^{major}.{minor}.0` on **minor or major bumps**
  - Patch bump (e.g. 24.6.0 → 24.6.1): no peerDeps change (existing `^24.6.0` covers it)
  - Minor bump (e.g. 24.5.0 → 24.6.0): add `|| ^24.6.0`
  - Major bump (e.g. 24.43.1 → 25.0.2): add `|| ^25.0.0`

### 2. `.github/workflows/ci.yml`

- Update `PUPPETEER_VERSION` env var (build job) to new version
- Add the new version to the `puppeteer-version` integration matrix, keeping **one entry per (major, minor)**: append for a new (major, minor); for a patch bump, **replace** the existing same-minor entry (never two patches of one minor, e.g. `24.6.0` and `24.6.1`)

### 3. `.github/workflows/publish.yml`

- Update `PUPPETEER_VERSION` env var in both `validate` and `publish` jobs to new version

### 4. `package-lock.json`

- Regenerated by `npm install` (`npm ci` fails when lockfile doesn't match updated package.json)

### Workflow

1. Create branch `imp/puppeteer-v{VERSION}`
2. Make the 4-file changes + run `npm install`
3. Commit: `(imp) puppeteer v{VERSION}`
4. Open PR, merge to main
5. Create GitHub Release (bumps package minor version)

## Task Tracking

- **Issues**: https://github.com/alexey-pelykh/puppeteer-capture/issues
- **Closing issues**: Use `Closes #N` in PR description
