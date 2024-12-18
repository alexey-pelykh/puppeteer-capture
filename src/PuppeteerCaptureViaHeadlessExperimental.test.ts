import { setTimeout } from 'node:timers/promises'
import { executablePath } from 'puppeteer'
import type { Browser as PuppeteerBrowser } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { PassThrough } from 'stream'
import { launch } from './launch'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

const PUPPETEER_LAUNCH_ARGS = [
  ...(process.platform !== 'win32' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [])
]

let browser: PuppeteerBrowser
afterEach(async () => {
  if (browser != null) {
    try {
      await browser.close()
    } catch (error) {}
  }
})

test('that capture fails if required args are missing', async () => {
  browser = await puppeteer.launch({
    executablePath: executablePath(),
    headless: 'shell',
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await expect(async () => {
    await capture.attach(page)
  }).rejects.toThrow()
})

test('that capture does not fail if required args are present', async () => {
  browser = await puppeteer.launch({
    executablePath: executablePath(),
    args: [
      ...PUPPETEER_LAUNCH_ARGS,
      ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS
    ]
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
})

test('that capture works in headless mode', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  await capture.waitForTimeout(32)
  await capture.stop()
  expect(capture.capturedFrames).toBeGreaterThan(1)
})

// test('that capture works repeatedly in headless mode', async () => {
//   browser = await launch({
//     executablePath: executablePath(),
//     args: PUPPETEER_LAUNCH_ARGS
//   })
//   const page = await browser.newPage()
//   const capture = new PuppeteerCaptureViaHeadlessExperimental()
//   await capture.attach(page)
//   await page.goto('about:blank')

//   const stream1 = new PassThrough()
//   await capture.start(stream1)
//   await capture.waitForTimeout(32)
//   await capture.stop()
//   expect(capture.capturedFrames).toBeGreaterThan(1)

//   const stream2 = new PassThrough()
//   await capture.start(stream2)
//   await capture.waitForTimeout(32)
//   await capture.stop()
//   expect(capture.capturedFrames).toBeGreaterThan(1)
// })

test('that capture works with custom viewport size', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  await page.setViewport({ width: 1920, height: 1080 })
  await capture.waitForTimeout(32)
  await capture.stop()
  expect(capture.capturedFrames).toBeGreaterThan(1)
})

test('that capture drops captured frames', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream, { dropCapturedFrames: true })
  await capture.waitForTimeout(32)
  await capture.stop()
  expect(capture.capturedFrames).toBeGreaterThan(1)
  expect(capture.recordedFrames).toBe(0)
})

test('that capture stops gracefully on FFMPEG error', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  const error = new Error('fake')
  await page.goto('about:blank')
  await capture.start(stream)
  capture['_ffmpegStream']!.emit('error', error) // eslint-disable-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/dot-notation
  await expect(async () => {
    await capture.stop()
  }).rejects.toThrow(error)
})

test('that capture stops gracefully on page close', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  await page.close()
  await expect(async () => {
    await capture.stop()
  }).rejects.toThrow('Page was closed')
})

test('that capture stops gracefully on session connection drop', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  capture['_session']!.emit('CDPSession.Disconnected', undefined) // eslint-disable-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/dot-notation
  await expect(async () => {
    await capture.stop()
  }).rejects.toThrow('Session was disconnected')
})

test('that capture is compatible with Date.now()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  const beforeTimeout = await page.evaluate('Date.now()') as number
  await capture.waitForTimeout(500)
  const afterTimeout = await page.evaluate('Date.now()') as number
  await capture.stop()
  expect(afterTimeout).toBeGreaterThan(beforeTimeout)
  const actualTimeout = afterTimeout - beforeTimeout
  expect(actualTimeout).toBeGreaterThan(450)
  expect(actualTimeout).toBeLessThan(550)
})

test('that capture is compatible with new Date().getTime()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  const beforeTimeout = await page.evaluate('new Date().getTime()') as number
  await capture.waitForTimeout(500)
  const afterTimeout = await page.evaluate('new Date().getTime()') as number
  await capture.stop()
  expect(afterTimeout).toBeGreaterThan(beforeTimeout)
  const actualTimeout = afterTimeout - beforeTimeout
  expect(actualTimeout).toBeGreaterThan(450)
  expect(actualTimeout).toBeLessThan(550)
})

test('that capture is compatible with performance.now()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental()
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  const beforeTimeout = await page.evaluate('performance.now()') as number
  await capture.waitForTimeout(500)
  const afterTimeout = await page.evaluate('performance.now()') as number
  await capture.stop()
  expect(afterTimeout).toBeGreaterThan(beforeTimeout)
  const actualTimeout = afterTimeout - beforeTimeout
  expect(actualTimeout).toBeGreaterThan(450)
  expect(actualTimeout).toBeLessThan(550)
})

test('that capture is compatible with setInterval()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  await page.evaluate('ticksCounter = 0; setInterval(function () { ticksCounter += 1 }, 50)')
  await capture.waitForTimeout(500)
  const ticksCounter = await page.evaluate('ticksCounter')
  await capture.stop()
  expect(ticksCounter).toBeGreaterThan(8)
  expect(ticksCounter).toBeLessThan(15)
})

test('that capture is compatible with setTimeout()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  await page.evaluate('ticksCounter = -1; function tick() { ticksCounter += 1; setTimeout(tick, 50) }; tick();')
  await capture.waitForTimeout(500)
  const ticksCounter = await page.evaluate('ticksCounter')
  await capture.stop()
  expect(ticksCounter).toBeGreaterThan(8)
  expect(ticksCounter).toBeLessThan(15)
})

test('that capture is compatible with requestAnimationFrame()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await capture.start(stream)
  await page.evaluate(`
    ticksCounter = 0;
    timeout = 0;
    previousTimeout = null;
    function tick(timestamp) {
      if (previousTimeout === null) {
        previousTimeout = timestamp;
      };
      timeout += timestamp - previousTimeout;
      previousTimeout = timeout;
      ticksCounter += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  `)
  await capture.waitForTimeout(500)
  const actualTimeout = await page.evaluate('timeout')
  const ticksCounter = await page.evaluate('ticksCounter')
  await capture.stop()
  expect(actualTimeout).toBeGreaterThan(400)
  expect(actualTimeout).toBeLessThan(1000)
  expect(ticksCounter).toBeGreaterThan(8)
  expect(ticksCounter).toBeLessThan(20)
})

test('that capture is compatible with bound window.requestAnimationFrame()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await page.evaluate('rAF = window.requestAnimationFrame.bind(window)')
  await capture.start(stream)
  await page.evaluate(`
    ticksCounter = 0;
    timeout = 0;
    previousTimeout = null;
    function tick(timestamp) {
      if (previousTimeout === null) {
        previousTimeout = timestamp;
      };
      timeout += timestamp - previousTimeout;
      previousTimeout = timeout;
      ticksCounter += 1;
      rAF(tick);
    };
    rAF(tick);
  `)
  await capture.waitForTimeout(500)
  const actualTimeout = await page.evaluate('timeout')
  const ticksCounter = await page.evaluate('ticksCounter')
  await capture.stop()
  expect(actualTimeout).toBeGreaterThan(400)
  expect(actualTimeout).toBeLessThan(1000)
  expect(ticksCounter).toBeGreaterThan(8)
  expect(ticksCounter).toBeLessThan(20)
})

test('that inactive capture is compatible with setInterval()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await page.evaluate('ticksCounter = 0; setInterval(function () { ticksCounter += 1 }, 50)')
  await setTimeout(500)
  const inactiveCaptureTicksCounter = await page.evaluate('ticksCounter')
  expect(inactiveCaptureTicksCounter).toBeGreaterThan(0)

  await capture.start(stream)
  await page.evaluate('ticksCounter = 0')
  await capture.waitForTimeout(500)
  const activeCaptureTicksCounter = await page.evaluate('ticksCounter') as number
  await capture.stop()
  expect(activeCaptureTicksCounter).toBeGreaterThan(0)
})

test('that inactive capture is compatible with setTimeout()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await page.evaluate('ticksCounter = -1; function tick() { ticksCounter += 1; setTimeout(tick, 50) }; tick();')
  await setTimeout(500)
  const inactiveCaptureTicksCounter = await page.evaluate('ticksCounter')
  expect(inactiveCaptureTicksCounter).toBeGreaterThan(0)

  await capture.start(stream)
  await page.evaluate('ticksCounter = 0')
  await capture.waitForTimeout(500)
  const activeCaptureTicksCounter = await page.evaluate('ticksCounter') as number
  await capture.stop()
  expect(activeCaptureTicksCounter).toBeGreaterThan(0)
})

test('that inactive capture is compatible with requestAnimationFrame()', async () => {
  browser = await launch({
    executablePath: executablePath(),
    args: PUPPETEER_LAUNCH_ARGS
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 20 })
  await capture.attach(page)
  const stream = new PassThrough()
  await page.goto('about:blank')
  await page.evaluate(`
    ticksCounter = 0;
    timeout = 0;
    previousTimeout = null;
    function tick(timestamp) {
      if (previousTimeout === null) {
        previousTimeout = timestamp;
      };
      timeout += timestamp - previousTimeout;
      previousTimeout = timeout;
      ticksCounter += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  `)
  await setTimeout(500)
  const [inactiveCaptureTicksCounter, inactiveActualTimeout] = await page.evaluate('[ticksCounter, timeout]') as number[]
  expect(inactiveCaptureTicksCounter).toBeGreaterThan(0)
  expect(inactiveActualTimeout).toBeGreaterThan(0)

  await capture.start(stream)
  await page.evaluate(`
    ticksCounter = 0;
    timeout = 0;
    previousTimeout = null;
  `)
  await capture.waitForTimeout(500)
  const [activeCaptureTicksCounter, activeActualTimeout] = await page.evaluate('[ticksCounter, timeout]') as number[]
  await capture.stop()
  expect(activeCaptureTicksCounter).toBeGreaterThan(0)
  expect(activeActualTimeout).toBeGreaterThan(0)
})
