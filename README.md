# puppeteer-capture

![node-current](https://img.shields.io/node/v/puppeteer-capture)
![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/alexey-pelykh/puppeteer-capture/ci.yml?branch=main)
![Codecov](https://img.shields.io/codecov/c/gh/alexey-pelykh/puppeteer-capture)
![Code Climate maintainability](https://img.shields.io/codeclimate/maintainability/alexey-pelykh/puppeteer-capture)
[![GitHub license](https://img.shields.io/github/license/alexey-pelykh/puppeteer-capture)](https://github.com/alexey-pelykh/puppeteer-capture/blob/main/LICENSE)

A Puppeteer plugin for capturing page as a video.

## Under The Hood

[`HeadlessExperimental`](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/) is used to capture frames in a deterministic way. This approach allows to achieve better quality than using screencast.

## Getting Started

```js
const { capture, launch } = require('puppeteer-capture')

(async () => {
  const browser = await launch()
  const page = await browser.newPage()
  const recorder = await capture(page)
  await page.goto('https://google.com', {
    waitUntil: 'networkidle0',
  })
  await recorder.start('capture.mp4')
  await page.waitForTimeout(1000)
  await recorder.stop()
  await recorder.detach()
  await browser.close()
})()
```

## Known Issues

### MacOS is not supported

Unfortunately, [it is so](https://source.chromium.org/chromium/chromium/src/+/main:headless/lib/browser/protocol/target_handler.cc;drc=5811aa08e60ba5ac7622f029163213cfbdb682f7;l=32).

## No capturing == Nothing happens

This relates to timers, animations, clicks, etc. To process interaction with the page, frame requests have to be submitted and thus capturing have to be active.

## Setting `defaultViewport` causes rendering to freeze

The exact origin of the issue is not yet known, yet it's likely to be related to the deterministic mode.

Calling `page.setViewport()` before starting the capture behaves the same, yet calling it _after_ starting the capture works yet not always. Thus it's safe to assume that there's some sort of race condition, since adding `page.waitForTimeout(100)` just before setting the viewport workarounds the issue.

Also it should be taken into account that since frame size is going to change over the time of the recording, frame size autodetection will fail. To workaround this issue, frame size have to be specified:
```js
const recorder = await capture(page, {
  size: `${viewportWidth}x${viewportHeight}`,
})
await recorder.start('capture.mp4', { waitForTimeout: false })
await page.waitForTimeout(100)
await page.setViewport({
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1.0,
})
```

A friendlier workaround is enabled by default: `recorder.start()` automatically waits for the first frame to be captured.
This approach seems to allow bypassing the alleged race condition:

```js
const recorder = await capture(page, {
  size: `${viewportWidth}x${viewportHeight}`,
})
await recorder.start('capture.mp4')
await page.setViewport({
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1.0,
})
```

## `waitForTimeout()` won't work

The `Page.waitForTimeout()` method implementation essentially forwards the call to the `Frame.waitForTimeout()` on the `page.mainFrame()`. The latter is implemented via `setTimeout()`, thus can not work in deterministic mode at all.

To workaround this issue, there's a `PuppeteerCapture.waitForTimeout()` that waits for the timeout in the timeline of the captured page, which is not real time at all. For convenience, while capturing is active, the page's `waitForTimeout()` becomes a wrapper for `PuppeteerCapture.waitForTimeout()`.

## Multiple `start()`/`stop()` fail

It's unclear why, yet after disabling and re-enabling the capture, callbacks from browser stop arriving.

## Time-related functions are affected

The following functions have to be overriden with injected versions:

- `setTimeout` & `clearTimeout`
- `setInterval` & `clearInterval`
- `requestAnimationFrame` & `cancelAnimationFrame`
- `Date()` & `Date.now()`
- `performance.now()`

The injection should happen before page content loads:

```js
const recorder = await capture(page) // Injection happens here during attach()
await page.goto('https://google.com') // Possible capture would happen here, thus injected versions would be captured
```

## Events

`PuppeteerCapture` supports following events:

 - `captureStarted`: capture was successfully started
 - `frameCaptured`: frame was captured
 - `frameCaptureFailed`: frame capture failed
 - `frameRecorded`: frame has been submitted to `ffmpeg`
 - `captureStopped`: capture was stopped

## Dependencies

### `ffmpeg`

It is resolved in the following order:

1. `FFMPEG` environment variable, should point to the executable
2. The executable that's available via the `PATH` environment variable
3. Via `@ffmpeg-installer/ffmpeg`, if it's installed as dependency
