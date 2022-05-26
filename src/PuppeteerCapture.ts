import * as puppeteer from "puppeteer";

export interface PuppeteerCapture {
    get page(): puppeteer.Page
    get isCapturing(): boolean
    start(filepath: string): Promise<void>
    stop(): Promise<void>
}
