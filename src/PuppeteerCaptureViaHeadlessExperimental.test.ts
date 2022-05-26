import * as puppeteer from "puppeteer";
import { PuppeteerCaptureViaHeadlessExperimental } from "./PuppeteerCaptureViaHeadlessExperimental";

jest.useFakeTimers()

let browser: puppeteer.Browser
afterEach(async () => {
    if (browser) {
        await browser.close()
    }
})

test("that capture fails if required args are missing", async () => {
    browser = await puppeteer.launch({
        args: [
            "--no-sandbox", // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
        ],
    })
    const page = await browser.newPage()
    expect(() => new PuppeteerCaptureViaHeadlessExperimental(page)).toThrow()
})

test("that capture does not fail if required args are present", async () => {
    browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox", // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
            ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
        ],
    })
    const page = await browser.newPage()
    new PuppeteerCaptureViaHeadlessExperimental(page)
})

// test("that capture works in headless mode", async () => {
//     browser = await puppeteer.launch({
//         headless: true,
//         args: [
//             "--no-sandbox", // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
//             ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
//         ],
//     })
//     const page = await browser.newPage()
//     const capture = new PuppeteerCaptureViaHeadlessExperimental(page)
//     await page.goto("https://google.com")
//     await capture.start("output.mp4")
//     await page.waitForTimeout(1)
//     await capture.stop()
// })

// test("that 1s at 25 FPS capture emits 25 frames", async () => {
//     const browser = await puppeteer.launch({
//         headless: true,
//         args: [
//             "--no-sandbox", // NOTE: https://github.com/puppeteer/puppeteer/issues/3698
//             ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS,
//         ],
//     })
//     const page = await browser.newPage()
//     const capture = new PuppeteerCaptureViaHeadlessExperimental(page, { fps: 25 })
//     await page.goto("https://google.com")
//     await capture.start("output.mp4")
//     await page.waitForTimeout(1000)
//     await capture.stop()
//     await browser.close()
// })
