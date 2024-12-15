import type { Page as PuppeteerPage } from 'puppeteer-core'
import { PuppeteerCapture } from './PuppeteerCapture'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function capture (
  page: PuppeteerPage,
  options?: PuppeteerCaptureOptions & { attach?: boolean }
): Promise<PuppeteerCapture> {
  const puppeteerCapture = new PuppeteerCaptureViaHeadlessExperimental(options)
  if (options?.attach !== false) {
    await puppeteerCapture.attach(page)
  }
  return puppeteerCapture
}
