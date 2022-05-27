# puppeteer-capture

A Puppeteer plugin for capturing page as a video.

## Under The Hood

[`HeadlessExperimental`](https://chromedevtools.github.io/devtools-protocol/tot/HeadlessExperimental/) is used to capture frames in a deterministic way. This approach allows to achieve better quality than using screencast.

## Known Issues

### MacOS is not supported

Unfortunately, [it is so](https://source.chromium.org/chromium/chromium/src/+/main:headless/lib/browser/protocol/target_handler.cc;drc=5811aa08e60ba5ac7622f029163213cfbdb682f7;l=32).

## No capturing == Nothing happens

This relates to timers, animations, clicks, etc. To process interaction with the page, frame requests have to be submitted and thus capturing have to be active.

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
