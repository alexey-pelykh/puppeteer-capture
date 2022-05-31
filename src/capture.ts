import puppeteer from 'puppeteer'
import { PuppeteerCapture } from './PuppeteerCapture'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function capture (page: puppeteer.Page, options?: PuppeteerCaptureOptions & { attach?: boolean }): Promise<PuppeteerCapture> {
  const puppeteerCapture = new PuppeteerCaptureViaHeadlessExperimental(options)
  if (options?.attach !== false) {
    await puppeteerCapture.attach(page)
  }
  return puppeteerCapture
}
