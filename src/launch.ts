import type {
  Browser as PuppeteerBrowser,
  BrowserConnectOptions as PuppeteerBrowserConnectOptions,
  BrowserLaunchArgumentOptions as PuppeteerBrowserLaunchArgumentOptions,
  LaunchOptions as PuppeteerLaunchOptions,
  Product as PuppeteerProduct
} from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function launch (
  options?: PuppeteerLaunchOptions & PuppeteerBrowserLaunchArgumentOptions & PuppeteerBrowserConnectOptions & {
    product?: PuppeteerProduct
    extraPrefsFirefox?: Record<string, unknown>
  }
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
