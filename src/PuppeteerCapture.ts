import type { Page as PuppeteerPage } from 'puppeteer-core'
import { Writable } from 'stream'
import { PuppeteerCaptureEvents } from './PuppeteerCaptureEvents'
import { PuppeteerCaptureStartOptions } from './PuppeteerCaptureStartOptions'

export interface PuppeteerCapture {
  page: PuppeteerPage | null
  isCapturing: boolean
  captureTimestamp: number
  capturedFrames: number
  dropCapturedFrames: boolean
  recordedFrames: number
  attach: (page: PuppeteerPage) => Promise<void>
  detach: () => Promise<void>
  start: (target: string | Writable, options?: PuppeteerCaptureStartOptions) => Promise<void>
  stop: () => Promise<void>
  waitForTimeout: (milliseconds: number) => Promise<void>
  on: <Event extends keyof PuppeteerCaptureEvents>(event: Event, listener: PuppeteerCaptureEvents[Event]) => this
}
