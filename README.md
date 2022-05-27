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

## Getting Started

```js
const puppeteer = require('puppeteer')
const { capture, PuppeteerCaptureViaHeadlessExperimental } = require('puppeteer-capture')

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
    ],
  })
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
