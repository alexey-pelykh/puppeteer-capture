# puppeteer-capture

[![GitHub Repo stars](https://img.shields.io/github/stars/alexey-pelykh/puppeteer-capture?style=flat&logo=github)](https://github.com/alexey-pelykh/puppeteer-capture)
[![GitHub license](https://img.shields.io/github/license/alexey-pelykh/puppeteer-capture)](https://github.com/alexey-pelykh/puppeteer-capture/blob/main/LICENSE)
![node-current](https://img.shields.io/node/v/puppeteer-capture)
[![NPM Version](https://img.shields.io/npm/v/puppeteer-capture)](https://www.npmjs.com/package/puppeteer-capture)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/alexey-pelykh/puppeteer-capture/ci.yml?branch=main)
![Codecov](https://img.shields.io/codecov/c/gh/alexey-pelykh/puppeteer-capture)
![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability/alexey-pelykh/puppeteer-capture)

A Puppeteer plugin for capturing page as a video with ultimate quality.

Standard screencast approaches capture frames in real time, producing inconsistent frame timing and
non-reproducible output. **puppeteer-capture** uses Chrome's
[`HeadlessExperimental`](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/) CDP domain
to capture each frame deterministically. If you need frame-perfect, reproducible video output from Puppeteer,
this is the only option.

## Quick Start

```bash
npm install puppeteer-capture puppeteer
```

```js
import { capture, launch } from 'puppeteer-capture'

const browser = await launch()
const page = await browser.newPage()
const recorder = await capture(page)

await page.goto('https://example.com', { waitUntil: 'networkidle0' })
await recorder.start('capture.mp4')
await recorder.waitForTimeout(1000)
await recorder.stop()
await recorder.detach()
await browser.close()
```

## Key Features

- **Deterministic frame timing** — frames are captured on demand via CDP, not in real time
- **Frame-perfect reproducible output** — the same page produces the same video, every time
- **CDP-powered** — uses `HeadlessExperimental.beginFrame` for precise frame control
- **Virtual time control** — `waitForTimeout()` advances the page's own timeline
- **Works with any Puppeteer workflow** — drop-in alongside existing Puppeteer scripts

## Comparison

| | puppeteer-capture | puppeteer-screen-recorder | Playwright built-in |
|---|---|---|---|
| Approach | CDP `HeadlessExperimental` | Screencast | Screencast |
| Frame timing | Deterministic | Real-time | Real-time |
| Reproducibility | Frame-perfect | Varies | Varies |
| Time control | Full (virtual clock) | None | None |
| Platform | Linux, Windows | All | All |

## Platform Risk: `HeadlessExperimental` Dependency

This library depends entirely on Chrome's
[`HeadlessExperimental`](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/) CDP domain
— specifically the
[`beginFrame`](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/#method-beginFrame)
method — for deterministic frame capture. This is the only mechanism in Chrome that provides compositor-level frame
scheduling, which is what enables frame-perfect, reproducible video output.

### Current status

- **`beginFrame`** is **not deprecated** and remains actively implemented in the
  [Chromium source](https://chromium.googlesource.com/chromium/src/+/main/headless/lib/browser/protocol/headless_handler.cc).
- **`enable`/`disable`** are marked deprecated in the
  [protocol definition](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/HeadlessExperimental.pdl)
  (they are no-ops and have no functional impact).
- The domain is labeled **Experimental**, meaning it can change without notice.
- `beginFrame` is exclusive to
  [`chrome-headless-shell`](https://developer.chrome.com/blog/chrome-headless-shell) (the old headless architecture).
  It is **not available** in `--headless=new`.

### Risk assessment

| Timeframe | Risk | Rationale |
|-----------|------|-----------|
| Near-term (0–12 months) | **Low** | `beginFrame` is not deprecated; implementation receives maintenance commits; `chrome-headless-shell` ships with every Chrome release. |
| Medium-term (1–3 years) | **Moderate** | The "Experimental" label has persisted since inception without graduating to stable. No public commitment to long-term `chrome-headless-shell` maintenance exists. |
| Long-term (3+ years) | **Moderate–High** | Chrome's strategic direction favors `--headless=new`. If `chrome-headless-shell` is eventually discontinued, `beginFrame` goes with it. |

### Why there is no drop-in alternative

`HeadlessExperimental.beginFrame` is unique because it controls **when** the compositor renders each frame. The
alternatives — `Page.startScreencast`, `Page.captureScreenshot`, tab capture — all capture frames produced by Chrome's
own compositor timing, which means:

- Frame timing depends on wall-clock time and system load (non-deterministic).
- CSS animations, transitions, and compositor-driven effects cannot be synchronized to a virtual timeline.
- Two runs of the same page may produce different frame counts and visual output.

A partial fallback using `Page.captureScreenshot` with JavaScript time virtualization can achieve determinism for
JS-driven content but **not** for CSS animations or compositor-driven effects.

### Mitigating factors

- [Remotion](https://www.remotion.dev/) and other ecosystem projects also depend on `chrome-headless-shell` for
  deterministic rendering, creating broader pressure to maintain the binary.
- Active Chromium issues (e.g., [#40550372](https://issues.chromium.org/issues/40550372) — making BeginFrameControl
  work with Viz) indicate ongoing investment, not abandonment.
- Chromium's deprecation process typically involves long warning periods and migration paths.

### Monitoring

To track changes to this dependency:

- [Chromium `HeadlessExperimental.pdl`](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/public/devtools_protocol/domains/HeadlessExperimental.pdl)
  — protocol definition (watch for deprecation annotations on `beginFrame`)
- [Chromium `headless_handler.cc`](https://chromium.googlesource.com/chromium/src/+/main/headless/lib/browser/protocol/headless_handler.cc)
  — implementation (watch for removal or functional changes)
- [Chrome DevTools Protocol changelog](https://github.com/ChromeDevTools/devtools-protocol/blob/master/changelog.md)
- [headless-dev mailing list](https://groups.google.com/a/chromium.org/g/headless-dev) — discussions on headless mode
  future

## Time Flow

The browser runs in deterministic mode, so the time flow is not real time. To wait for a certain amount of time
within the page's timeline, use `PuppeteerCapture.waitForTimeout()`:

```js
await recorder.waitForTimeout(1000)
```

## Events

`PuppeteerCapture` emits the following events:

- `captureStarted` — capture was successfully started
- `frameCaptured` — a frame was captured
- `frameCaptureFailed` — frame capture failed
- `frameRecorded` — a frame has been submitted to ffmpeg
- `captureStopped` — capture was stopped

## Dependencies

### ffmpeg

ffmpeg is resolved in the following order:

1. `FFMPEG` environment variable pointing to the executable
2. The executable available via `PATH`
3. Via `@ffmpeg-installer/ffmpeg`, if installed as a dependency

## Known Issues

See [Known Issues](KNOWN_ISSUES.md) for platform constraints and workarounds.

## Contributing

See [Contributing](CONTRIBUTING.md) for development setup and guidelines.

## License

[MIT](LICENSE)
