import puppeteer from 'puppeteer'
import { PassThrough } from 'stream'
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
        headless: true,
        args: [
            '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
            ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
        ],
    })
    const page = await browser.newPage()
    new PuppeteerCaptureViaHeadlessExperimental(page)
})

test('that capture works in headless mode', async () => {
    browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
            ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
        ],
    })
    const page = await browser.newPage()
    const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
    const stream = new PassThrough()
    await page.goto('https://google.com')
    await capture.start(stream)
    await page.waitForTimeout(32)
    await capture.stop()
    expect(capture.framesCaptured).toBeGreaterThan(1)
})

test('that capture works with custom viewport size', async () => {
    browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox', // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
            ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
        ],
    })
    const page = await browser.newPage()
    const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
    const stream = new PassThrough()
    await page.goto('https://google.com')
    await capture.start(stream)
    await page.setViewport({ width: 1920, height: 1080 })
    await capture.stop()
    expect(capture.framesCaptured).toBeGreaterThan(1)
})
