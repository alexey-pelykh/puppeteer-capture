import puppeteer from 'puppeteer'
import { Writable } from 'stream'
import { PuppeteerCaptureEvents } from './PuppeteerCaptureEvents'
import { PuppeteerCaptureStartOptions } from './PuppeteerCaptureStartOptions'

export interface PuppeteerCapture {
  page: puppeteer.Page
  isCapturing: boolean
  captureTimestamp: number
  framesCaptured: number
  //TODO: dropCapturedFrames: boolean
  //TODO: framesRecorded: number
  start: (target: string | Writable, options?: PuppeteerCaptureStartOptions) => Promise<void>
  stop: () => Promise<void>
  waitForTimeout: (milliseconds: number) => Promise<void>
  on: <Event extends keyof PuppeteerCaptureEvents>(event: Event, listener: PuppeteerCaptureEvents[Event]) => this
}
