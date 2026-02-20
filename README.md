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
