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
    const promise = new Promise((resolve, reject) => {
        let dataSize = 0
        stream
            .on('data', (chunk) => { dataSize += chunk.length })
            .on('end', () => { dataSize > 0 ? resolve(dataSize) : reject() })
            .on('error', reject)
    })
    await page.goto('https://google.com')
    await capture.start(stream)
    await page.waitForTimeout(32)
    await capture.stop()
    return promise
})
