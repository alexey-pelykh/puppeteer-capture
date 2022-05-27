# puppeteer-capture

A Puppeteer plugin for capturing page as a video.

## Under The Hood

[`HeadlessExperimental`](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/) is used to capture frames in a deterministic way. This approach allows to achieve better quality than using screencast.

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
  await browser.close()
})()
```
