import puppeteer from 'puppeteer'
import { MissingHeadlessExperimentalRequiredArgs } from './MissingHeadlessExperimentalRequiredArgs'
import { PuppeteerCaptureBase } from './PuppeteerCaptureBase'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'

export class PuppeteerCaptureViaHeadlessExperimental extends PuppeteerCaptureBase {
  public static REQUIRED_ARGS = [
    '--deterministic-mode',
    '--enable-begin-frame-control',
    '--disable-new-content-rendering-timeout',
    '--run-all-compositor-stages-before-draw',
    '--disable-threaded-animation',
    '--disable-threaded-scrolling',
    '--disable-checker-imaging',
    '--disable-image-animation-resync',
    '--enable-surface-synchronization'
  ]

  public constructor (page: puppeteer.Page, options?: PuppeteerCaptureOptions) {
    super(page, options)

    if (process.platform === 'darwin') {
      throw new Error('MacOS is not supported by HeadlessExperimental.BeginFrame')
    }

    PuppeteerCaptureViaHeadlessExperimental.validateBrowserArgs(page.browser())
  }

  protected override async configureSession (session: puppeteer.CDPSession): Promise<void> {
    await session.send('HeadlessExperimental.enable')
  }

  protected override async deconfigureSession (session: puppeteer.CDPSession): Promise<void> {
    if (!this._page.isClosed()) {
      await session.send('HeadlessExperimental.disable')
    }
  }

  protected override async captureFrame (): Promise<void> {
    if (!this._isCapturing || this._captureError != null) {
      return
    }

    if (this._session == null) {
      throw new Error('No session available')
    }

    this._frameBeingCaptured = this._session.send('HeadlessExperimental.beginFrame', {
      frameTimeTicks: this._captureTimestamp,
      interval: this._frameInterval,
      noDisplayUpdates: false,
      screenshot: { format: 'png' }
    }).then(
      async ({ screenshotData: dataBase64 }) => {
        this._frameBeingCaptured = null

        if (dataBase64 == null) {
          setTimeout(this._captureFrame, 0)
          return
        }

        const data = Buffer.from(dataBase64, 'base64')
        await this.onFrameCaptured(this._captureTimestamp, data)

        if (this._isCapturing) {
          this._captureTimestamp += this._frameInterval
          setTimeout(this._captureFrame, 0)
        }
      },
      async (reason) => {
        this._frameBeingCaptured = null

        await this.onFrameCaptureFailed(reason)
      }
    )
  }

  private static validateBrowserArgs (browser: puppeteer.Browser): void {
    const spawnargs = browser.process()?.spawnargs
    if (spawnargs == null || !PuppeteerCaptureViaHeadlessExperimental.REQUIRED_ARGS.every(arg => spawnargs.includes(arg))) {
      throw new MissingHeadlessExperimentalRequiredArgs()
    }
  }
}
