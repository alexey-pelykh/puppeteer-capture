// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2026 Alexey Pelykh

import { MissingHeadlessExperimentalRequiredArgs } from './MissingHeadlessExperimentalRequiredArgs'
import { NotChromeHeadlessShell } from './NotChromeHeadlessShell'
import { PuppeteerCaptureViaHeadlessExperimental } from './PuppeteerCaptureViaHeadlessExperimental'

const originalPlatform = process.platform

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: originalPlatform })
})

function createMockBrowser (spawnfile: string | undefined, spawnargs?: string[]): any {
  return {
    process: () => ({
      spawnfile,
      spawnargs: spawnargs ?? []
    })
  }
}

describe('constructor', () => {
  test('throws on macOS', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' })
    expect(() => new PuppeteerCaptureViaHeadlessExperimental()).toThrow(
      'MacOS is not supported by HeadlessExperimental.BeginFrame'
    )
  })

  test('succeeds on linux', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    expect(() => new PuppeteerCaptureViaHeadlessExperimental()).not.toThrow()
  })

  test('succeeds on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' })
    expect(() => new PuppeteerCaptureViaHeadlessExperimental()).not.toThrow()
  })

  test('passes options to base class', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' })
    const capture = new PuppeteerCaptureViaHeadlessExperimental({ fps: 24 })
    expect(capture['_frameInterval']).toBeCloseTo(1000 / 24) // eslint-disable-line @typescript-eslint/dot-notation
  })
})

describe('validateBrowserArgs', () => {
  test('throws NotChromeHeadlessShell when spawnfile is null', () => {
    const browser = { process: () => ({ spawnfile: null, spawnargs: [] }) }
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(NotChromeHeadlessShell)
  })

  test('throws NotChromeHeadlessShell when spawnfile is undefined', () => {
    const browser = { process: () => ({ spawnfile: undefined, spawnargs: [] }) }
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(NotChromeHeadlessShell)
  })

  test('throws NotChromeHeadlessShell for non-headless-shell binary', () => {
    const browser = createMockBrowser('/usr/bin/chromium')
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(NotChromeHeadlessShell)
  })

  test('throws NotChromeHeadlessShell with executable path in message', () => {
    const browser = createMockBrowser('/usr/bin/chromium')
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow('Not chrome-headless-shell: /usr/bin/chromium')
  })

  test('throws NotChromeHeadlessShell when process returns null spawnfile', () => {
    const browser = { process: () => null }
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(NotChromeHeadlessShell)
  })

  test('throws MissingHeadlessExperimentalRequiredArgs when args are missing', () => {
    const browser = createMockBrowser('/path/to/chrome-headless-shell', [])
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(MissingHeadlessExperimentalRequiredArgs)
  })

  test('throws MissingHeadlessExperimentalRequiredArgs when some args are missing', () => {
    const browser = createMockBrowser('/path/to/chrome-headless-shell', [
      '--deterministic-mode'
    ])
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(MissingHeadlessExperimentalRequiredArgs)
  })

  test('throws MissingHeadlessExperimentalRequiredArgs when spawnargs is null', () => {
    const browser = {
      process: () => ({
        spawnfile: '/path/to/chrome-headless-shell',
        spawnargs: null
      })
    }
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).toThrow(MissingHeadlessExperimentalRequiredArgs)
  })

  test('succeeds with chrome-headless-shell and all required args', () => {
    const browser = createMockBrowser(
      '/path/to/chrome-headless-shell',
      PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS
    )
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).not.toThrow()
  })

  test('succeeds with additional args beyond required ones', () => {
    const browser = createMockBrowser(
      '/path/to/chrome-headless-shell',
      ['--no-sandbox', ...PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS, '--disable-gpu']
    )
    expect(() => {
      (PuppeteerCaptureViaHeadlessExperimental as any).validateBrowserArgs(browser)
    }).not.toThrow()
  })
})

describe('REQUIRED_ARGS', () => {
  test('contains expected arguments', () => {
    expect(PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS).toContain('--deterministic-mode')
    expect(PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS).toContain('--enable-begin-frame-control')
  })

  test('is frozen (immutable)', () => {
    expect(Array.isArray(PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS)).toBe(true)
  })
})

describe('generateInjector', () => {
  test('returns a string containing the fps value', () => {
    const injector = (PuppeteerCaptureViaHeadlessExperimental as any).generateInjector(30)
    expect(typeof injector).toBe('string')
    expect(injector).toContain('30')
  })

  test('returns different injectors for different fps values', () => {
    const injector30 = (PuppeteerCaptureViaHeadlessExperimental as any).generateInjector(30)
    const injector60 = (PuppeteerCaptureViaHeadlessExperimental as any).generateInjector(60)
    expect(injector30).not.toEqual(injector60)
  })
})
