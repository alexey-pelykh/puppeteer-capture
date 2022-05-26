import puppeteer from 'puppeteer'
import { PuppeteerCapture } from './PuppeteerCapture'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function capture (page: puppeteer.Page, options?: PuppeteerCaptureOptions): Promise<PuppeteerCapture> {
  if (process.platform === 'darwin') {
    throw new Error()
  }

  return new PuppeteerCaptureViaHeadlessExperimental(page, options)
}
