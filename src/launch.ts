import type {
  Browser as PuppeteerBrowser,
  PuppeteerLaunchOptions
} from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function launch (
  options?: PuppeteerLaunchOptions
): Promise<PuppeteerBrowser> {
  options = {
    ...(options != null ? options : {}),
    args: [
      ...(options?.args != null ? options?.args : []),
      ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS
    ]
  }

  return await puppeteer.launch(options)
}
