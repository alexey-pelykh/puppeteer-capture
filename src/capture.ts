import puppeteer from 'puppeteer'
import { PuppeteerCapture } from './PuppeteerCapture'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function capture (page: puppeteer.Page, options?: PuppeteerCaptureOptions): Promise<PuppeteerCapture> {
  return new PuppeteerCaptureViaHeadlessExperimental(page, options)
}
