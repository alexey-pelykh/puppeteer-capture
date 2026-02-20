# Known Issues

### `--headless=new` is not supported

Sadly, [it is so](https://issues.chromium.org/issues/361863270#comment2). For Puppeteer v23+, the plugin enforces use
of the `chrome-headless-shell` binary.

### Bad Chrome versions

- `117.0.5938.88` (default for `puppeteer` version(s) `21.3.0` ): reacts with `targetCrashed`
- `117.0.5938.92` (default for `puppeteer` version(s) `21.3.2`...`21.3.6`): reacts with `targetCrashed`
- `117.0.5938.149` (default for `puppeteer` version(s) `21.3.7`...`21.3.8`): reacts with `targetCrashed`
- `118.0.5993.70` (default for `puppeteer` version(s) `21.4.0`...`21.4.1`): reacts with `targetCrashed`
- `119.0.6045.105` (default for `puppeteer` version(s) `21.5.0`...`21.7.0`): reacts with `targetCrashed`
- `120.0.6099.109` (default for `puppeteer` version(s) `21.8.0`): reacts with `targetCrashed`

### macOS is not supported

Unfortunately, [it is so](https://source.chromium.org/chromium/chromium/src/+/main:headless/lib/browser/protocol/target_handler.cc;drc=5811aa08e60ba5ac7622f029163213cfbdb682f7;l=32).

### No capturing == Nothing happens

This relates to timers, animations, clicks, etc. To process interaction with the page, frame requests have to be
submitted and thus capturing have to be active.

### Setting `defaultViewport` causes rendering to freeze

The exact origin of the issue is not yet known, yet it's likely to be related to the deterministic mode.

Calling `page.setViewport()` before starting the capture behaves the same, yet calling it _after_ starting the capture
works yet not always. Thus it's safe to assume that there's some sort of race condition, since adding
`recorder.waitForTimeout(100)` just before setting the viewport workarounds the issue.

Also it should be taken into account that since frame size is going to change over the time of the recording, frame size
autodetection will fail. To workaround this issue, frame size have to be specified:

```js
const recorder = await capture(page, {
  size: `${viewportWidth}x${viewportHeight}`,
})
await recorder.start('capture.mp4', { waitForFirstFrame: false })
await recorder.waitForTimeout(100)
await page.setViewport({
  width: viewportWidth,
  height: viewportHeight,
  deviceScaleFactor: 1.0,
})
```

A friendlier workaround is enabled by default: `recorder.start()` automatically waits for the first frame to be
captured. This approach seems to allow bypassing the alleged race condition:

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

### Multiple `start()`/`stop()` fail

It's unclear why, yet after disabling and re-enabling the capture, callbacks from browser stop arriving.

### Time-related functions are affected

The following functions have to be overridden with injected versions:

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
