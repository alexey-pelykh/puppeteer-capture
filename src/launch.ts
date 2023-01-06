import type {
  Browser as PuppeteerBrowser,
  BrowserConnectOptions as PuppeteerBrowserConnectOptions,
  BrowserLaunchArgumentOptions as PuppeteerBrowserLaunchArgumentOptions,
  LaunchOptions as PuppeteerLaunchOptions,
  Product as PuppeteerProduct,
  PuppeteerNode
} from 'puppeteer'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const puppeteer = require(`puppeteer${process.env.PUPPETEER_CAPTURE__PUPPETEER_VERSION ?? ''}`)

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

  return await (puppeteer as PuppeteerNode).launch(options)
}
