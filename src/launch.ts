// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2026 Alexey Pelykh

import type {
  Browser as PuppeteerBrowser,
  LaunchOptions as PuppeteerLaunchOptions
} from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

export async function launch (
  options?: PuppeteerLaunchOptions
): Promise<PuppeteerBrowser> {
  options = {
    ...(options != null ? options : {}),
    headless: 'shell',
    args: [
      ...(options?.args != null ? options?.args : []),
      ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS
    ]
  }

  return await puppeteer.launch(options)
}
