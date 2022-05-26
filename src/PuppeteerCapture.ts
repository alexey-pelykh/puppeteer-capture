import puppeteer from 'puppeteer'

export interface PuppeteerCapture {
  page: puppeteer.Page
  isCapturing: boolean
  captureTimestamp: number
  start: (target: string | NodeJS.WritableStream) => Promise<void>
  stop: () => Promise<void>
}
