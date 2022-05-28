import puppeteer from 'puppeteer'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function launch (
  options?: puppeteer.LaunchOptions & puppeteer.BrowserLaunchArgumentOptions & puppeteer.BrowserConnectOptions & {
    product?: puppeteer.Product
    extraPrefsFirefox?: Record<string, unknown>
  }
): Promise<puppeteer.Browser> {
  options = {
    ...(options != null ? options : {}),
    args: [
      ...(options?.args != null ? options?.args : []),
      ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS
    ]
  }

  return await puppeteer.launch(options)
}
