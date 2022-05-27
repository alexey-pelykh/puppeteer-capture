import puppeteer from 'puppeteer'
import { PassThrough } from 'stream'
import { launch } from './launch'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

let browser: puppeteer.Browser
afterEach(async () => {
  if (browser) {
    await browser.close()
  }
})

test('that capture fails if required args are missing', async () => {
  browser = await puppeteer.launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
    ],
  })
  const page = await browser.newPage()
  expect(() => new PuppeteerCaptureViaHeadlessExperimental(page)).toThrow()
})

test('that capture does not fail if required args are present', async () => {
  browser = await puppeteer.launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
      ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
    ],
  })
  const page = await browser.newPage()
  new PuppeteerCaptureViaHeadlessExperimental(page)
})

test('that capture works in headless mode', async () => {
  browser = await launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
    ],
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
  const stream = new PassThrough()
  await page.goto('https://google.com')
  await capture.start(stream)
  await page.waitForTimeout(32)
  await capture.stop()
  expect(capture.capturedFrames).toBeGreaterThan(1)
})

// test('that capture works repeatedly in headless mode', async () => {
//   browser = await launch({
//     args: [
//       '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
//     ],
//   })
//   const page = await browser.newPage()
//   const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
//   await page.goto('https://google.com')

//   const stream1 = new PassThrough()
//   await capture.start(stream1)
//   await page.waitForTimeout(32)
//   await capture.stop()
//   expect(capture.capturedFrames).toBeGreaterThan(1)

//   const stream2 = new PassThrough()
//   await capture.start(stream2)
//   await page.waitForTimeout(32)
//   await capture.stop()
//   expect(capture.capturedFrames).toBeGreaterThan(1)
// })

test('that capture works with custom viewport size', async () => {
  browser = await launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
    ],
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
  const stream = new PassThrough()
  await page.goto('https://google.com')
  await capture.start(stream)
  await page.setViewport({ width: 1920, height: 1080 })
  await page.waitForTimeout(32)
  await capture.stop()
  expect(capture.capturedFrames).toBeGreaterThan(1)
})

test('that capture drops captured frames', async () => {
  browser = await launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
    ],
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
  const stream = new PassThrough()
  await page.goto('https://google.com')
  await capture.start(stream, { dropCapturedFrames: true })
  await page.waitForTimeout(32)
  await capture.stop()
  expect(capture.capturedFrames).toBeGreaterThan(1)
  expect(capture.recordedFrames).toBe(0)
})

test('that capture stops gracefully on FFMPEG error', async () => {
  browser = await launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
    ],
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
  const stream = new PassThrough()
  const error = new Error('fake')
  await page.goto('https://google.com')
  await capture.start(stream)
  capture['_ffmpegStream']!.emit('error', error)
  await expect(async () => {
    await capture.stop()
  }).rejects.toThrow(error)
})

test('that capture stops gracefully on page close', async () => {
  browser = await launch({
    args: [
      '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
    ],
  })
  const page = await browser.newPage()
  const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
  const stream = new PassThrough()
  await page.goto('https://google.com')
  await capture.start(stream)
  page.close()
  await expect(capture.stop()).rejects.toThrow()
})
