import puppeteer from 'puppeteer'
import { Writable } from 'stream'

export interface PuppeteerCapture {
  page: puppeteer.Page
  isCapturing: boolean
  captureTimestamp: number
  start: (target: string | Writable) => Promise<void>
  stop: () => Promise<void>
  waitForTimeout: (milliseconds: number) => Promise<void>
}
