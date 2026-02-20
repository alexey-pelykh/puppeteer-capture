# ADR-001: fluent-ffmpeg Deprecation Migration

**Status**: Accepted
**Date**: 2026-02-20
**Issue**: [#59](https://github.com/alexey-pelykh/puppeteer-capture/issues/59)

## Context

`fluent-ffmpeg` (npm: `fluent-ffmpeg@^2.1.3`) is the video encoding backbone of puppeteer-capture. The package was [archived on May 22, 2025](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg/issues/1324) and marked deprecated on npm. Last publish was v2.1.3 on 2024-05-19 (prior release was 2017).

The deprecation message on npm states: "Package no longer supported."

### Impact on puppeteer-capture

- **No future security patches** from upstream
- **No future ffmpeg CLI compatibility updates** (ffmpeg evolves its CLI regularly)
- **npm install warnings** for consumers: `npm warn deprecated fluent-ffmpeg@2.1.3`
- `@types/fluent-ffmpeg` will also stale (currently a devDependency)

### Current Usage Surface

puppeteer-capture uses a narrow slice of fluent-ffmpeg's API:

| Usage | File | Lines | fluent-ffmpeg API |
|-------|------|-------|-------------------|
| Constructor | `PuppeteerCaptureBase.ts` | 170 | `ffmpeg()` |
| Input stream | `PuppeteerCaptureBase.ts` | 172 | `.input(stream)` |
| Input format | `PuppeteerCaptureBase.ts` | 173 | `.inputFormat('image2pipe')` |
| Input FPS | `PuppeteerCaptureBase.ts` | 174 | `.inputFPS(fps)` |
| Output target | `PuppeteerCaptureBase.ts` | 176 | `.output(target)` |
| Output FPS | `PuppeteerCaptureBase.ts` | 177 | `.outputFPS(fps)` |
| Output size | `PuppeteerCaptureBase.ts` | 180 | `.size(size)` |
| Output format | `PuppeteerCaptureFormat.ts` | 9 | `.outputFormat('mp4')` |
| Video codec | `PuppeteerCaptureFormat.ts` | 9 | `.withVideoCodec(codec)` |
| Output option | `PuppeteerCaptureFormat.ts` | 10-11 | `.outputOption(opt)` |
| Set ffmpeg path | `PuppeteerCaptureBase.ts` | 166 | `setFfmpegPath(path)` |
| Run | `PuppeteerCaptureBase.ts` | 233 | `.run()` |
| Events | `PuppeteerCaptureBase.ts` | 198-231 | `.once('start')`, `.once('error')`, `.once('end')` |
| Cleanup | `PuppeteerCaptureBase.ts` | 288-293 | `.removeAllListeners()`, `.once('error')` |

**Public API exposure**: The `FfmpegCommand` type from fluent-ffmpeg is exposed in the public API via:
- `PuppeteerCaptureOptions.format` callback: `(ffmpeg: FfmpegCommand) => Promise<void>`
- `PuppeteerCaptureOptions.customFfmpegConfig` callback: `(ffmpeg: FfmpegCommand) => Promise<void>`
- `PuppeteerCaptureFormat.MP4()` return type: `(ffmpeg: FfmpegCommand) => Promise<void>`

This public API exposure means that consumers can use `FfmpegCommand` in their code for custom format configurations.

## Options Considered

### Option 1: Migrate to direct `child_process.spawn`

Replace fluent-ffmpeg with a thin internal module that spawns ffmpeg directly via `child_process.spawn`.

**Approach**: Map the narrow fluent-ffmpeg API surface to equivalent ffmpeg CLI arguments:

| fluent-ffmpeg call | ffmpeg CLI equivalent |
|--------------------|----------------------|
| `.input(stream)` | stdin pipe (`pipe:0`) |
| `.inputFormat('image2pipe')` | `-f image2pipe` |
| `.inputFPS(fps)` | `-framerate <fps>` |
| `.output(target)` | output path or `pipe:1` |
| `.outputFPS(fps)` | `-r <fps>` |
| `.size(size)` | `-s <size>` or `-vf scale=<size>` |
| `.outputFormat('mp4')` | `-f mp4` |
| `.withVideoCodec(codec)` | `-c:v <codec>` |
| `.outputOption(opt)` | direct passthrough |

**Pros**:
- Zero runtime dependency for ffmpeg invocation
- Full control over spawned process lifecycle
- No risk of upstream abandonment
- Smaller install footprint
- Direct access to ffmpeg stderr for diagnostics

**Cons**:
- Must handle process lifecycle (spawn, stdin pipe, exit codes, signals)
- Must design a new public API type to replace `FfmpegCommand` in callbacks
- **Breaking change** for `format` and `customFfmpegConfig` option callbacks
- Must add tests for the new spawn-based module

### Option 2: Migrate to `@ts-ffmpeg/fluent-ffmpeg` community fork

Drop-in replacement fork with integrated TypeScript types.

**Pros**:
- Minimal code changes (import path swap)
- API-compatible, no public API breakage
- Built-in TypeScript types (removes `@types/fluent-ffmpeg` devDependency)

**Cons**:
- Low adoption (2 dependents on npm as of 2026-02)
- Uncertain long-term maintenance (single maintainer)
- Inherits same architectural issues cited in deprecation
- Merely defers the problem: if this fork is also abandoned, same migration needed later
- Still wraps ffmpeg CLI with abstraction that may break with future ffmpeg versions

### Option 3: Accept the risk (document and defer)

Continue using `fluent-ffmpeg@2.1.3` with documented risk acceptance.

**Pros**:
- Zero effort, no code changes
- Package still works today and is still installable
- Pinned version avoids surprise breakage

**Cons**:
- npm deprecation warnings for all consumers
- No security patches
- May break with future ffmpeg versions
- Signals poor maintenance to potential adopters
- Technical debt compounds over time

### Option 4: Hybrid — thin abstraction layer over spawn

Create an internal abstraction that presents a builder-style API (similar to fluent-ffmpeg's chainable interface) but spawns ffmpeg directly.

**Pros**:
- Same benefits as Option 1 (no dependency)
- Familiar ergonomics for maintainers
- Could minimize public API breakage by designing a compatible callback type

**Cons**:
- More code than Option 1's direct spawn
- Risk of recreating fluent-ffmpeg's mistakes (over-abstraction)
- The narrow usage surface doesn't justify a builder pattern

## Decision

**Recommended: Option 1 (direct `child_process.spawn`)** with a compatibility adapter for the public API transition.

### Rationale

1. **Narrow usage surface**: puppeteer-capture uses ~12 API methods. Mapping these to CLI arguments is straightforward and the resulting code will be simpler than the current fluent-ffmpeg integration.

2. **Dependency elimination**: Removes `fluent-ffmpeg` (runtime) and `@types/fluent-ffmpeg` (dev), plus transitive dependencies (`which` bundled in fluent-ffmpeg).

3. **Long-term stability**: Direct spawn against a stable CLI (`ffmpeg`) is more resilient than depending on a wrapper library's interpretation of that CLI.

4. **Public API handling**: The `format` and `customFfmpegConfig` callbacks currently receive a `FfmpegCommand`. The migration must introduce a new type to replace this:
   - Define an `FfmpegArgs` builder or plain object that exposes the same configurability
   - The `PuppeteerCaptureFormat.MP4()` function and similar format factories would return the new type
   - This is a **breaking change** requiring a semver major version bump

5. **Community fork rejected**: `@ts-ffmpeg/fluent-ffmpeg` only defers the problem and introduces a new single-maintainer risk.

## Implementation Plan

### Phase 1: Internal spawn module (non-breaking)

1. Create `src/ffmpeg.ts` — internal module that:
   - Accepts ffmpeg binary path, input stream, output target, and argument arrays
   - Spawns ffmpeg via `child_process.spawn`
   - Pipes input stream to stdin
   - Emits `start`, `end`, `error` events (matching current usage)
   - Handles process lifecycle (exit codes, signals, stderr capture)

2. Add unit tests for the spawn module

### Phase 2: Replace internal usage

3. Refactor `PuppeteerCaptureBase._start()` to use the new spawn module instead of fluent-ffmpeg
4. Update `PuppeteerCaptureBase._stop()` process cleanup
5. Verify all existing tests pass with the new implementation

### Phase 3: Public API migration (breaking)

6. Design replacement type for `FfmpegCommand` in option callbacks:
   - Option A: `FfmpegArgs` builder with chainable methods mirroring needed subset
   - Option B: Plain configuration object `{ inputFormat?, inputFPS?, outputFormat?, videoCodec?, outputOptions?, size? }`
   - Option B is preferred for simplicity and type safety

7. Update `PuppeteerCaptureOptions` interface
8. Update `PuppeteerCaptureFormat.ts` format factories
9. Update documentation and CHANGELOG

### Phase 4: Cleanup

10. Remove `fluent-ffmpeg` from `dependencies`
11. Remove `@types/fluent-ffmpeg` from `devDependencies`
12. Verify `which` package is still needed (currently used for ffmpeg resolution independent of fluent-ffmpeg, so it stays)
13. Run full CI matrix

### Migration effort estimate

| Phase | Files changed | Risk |
|-------|---------------|------|
| 1 | 1 new file + tests | Low — isolated new code |
| 2 | 1 file (`PuppeteerCaptureBase.ts`) | Medium — core capture logic |
| 3 | 3 files (Options, Format, Base) | High — public API break |
| 4 | 2 files (`package.json`, `package-lock.json`) | Low — dependency removal |

## Consequences

- **Breaking change**: Consumers using `format` or `customFfmpegConfig` callbacks must update their code. This requires a semver major version bump.
- **Reduced dependency surface**: One fewer runtime dependency and its transitive tree.
- **Maintenance ownership**: ffmpeg CLI argument mapping becomes our responsibility, but the surface is small and stable.
- **Testing**: The spawn module needs its own test coverage for process lifecycle edge cases (ffmpeg not found, ffmpeg crashes, stdin backpressure).
