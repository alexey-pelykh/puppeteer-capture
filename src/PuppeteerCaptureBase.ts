import puppeteer from 'puppeteer'
import { mkdir } from 'fs/promises'
import { PassThrough, Writable } from 'stream'
import { dirname } from 'path'
import which from 'which'
import ffmpeg, { setFfmpegPath, FfmpegCommand } from 'fluent-ffmpeg'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'
import { PuppeteerCapture } from './PuppeteerCapture'
import { h264 } from './PuppeteerCaptureFormat'

export abstract class PuppeteerCaptureBase implements PuppeteerCapture {
  public static DEFAULT_OPTIONS: PuppeteerCaptureOptions = {
    fps: 60,
    format: h264()
  }

  protected readonly _page: puppeteer.Page
  protected readonly _options: PuppeteerCaptureOptions
  protected readonly _frameInterval: number
  protected readonly _captureFrame: Function
  protected _target: string | Writable | null
  protected _session: puppeteer.CDPSession | null
  protected _frameBeingCaptured: Promise<void> | null
  protected _captureTimestamp: number
  protected _captureError: any | null
  protected _framesStream: PassThrough | null
  protected _ffmpegStream: FfmpegCommand | null
  protected _ffmpegExited: Promise<void> | null
  protected _isCapturing: boolean

  public constructor (page: puppeteer.Page, options?: PuppeteerCaptureOptions) {
    this._page = page
    this._options = {
      ...PuppeteerCaptureBase.DEFAULT_OPTIONS,
      ...(options !== null ? options : {})
    }
    if (this._options.fps == null) {
      throw new Error('options.fps needs to be set')
    }
    if (this._options.fps < 0) {
      throw new Error(`options.fps can not be set to ${this._options.fps}`)
    }
    this._frameInterval = 1000.0 / this._options.fps
    this._captureFrame = this.captureFrame.bind(this)
    this._target = null
    this._session = null
    this._frameBeingCaptured = null
    this._captureTimestamp = 0
    this._captureError = null
    this._framesStream = null
    this._ffmpegStream = null
    this._ffmpegExited = null
    this._isCapturing = false
  }

  public get page (): puppeteer.Page {
    return this._page
  }

  public get isCapturing (): boolean {
    return this._isCapturing
  }

  public get captureTimestamp (): number {
    return this._captureTimestamp
  }

  public async start (target: string | Writable): Promise<void> {
    if (this._isCapturing) {
      throw new Error('Capture is in progress')
    }

    if (this._page.isClosed()) {
      throw new Error('Can not start capturing a closed page')
    }

    if (typeof target === 'string' || target instanceof String) {
      await mkdir(dirname(target.toString()), { recursive: true })
    }

    const framesStream = new PassThrough()

    setFfmpegPath(this._options.ffmpeg != null
      ? this._options.ffmpeg
      : await PuppeteerCaptureBase.findFfmpeg()
    )
    const ffmpegStream = ffmpeg()
    ffmpegStream
      .input(framesStream)
      .inputFormat('image2pipe')
      .inputFPS(this._options.fps!) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    ffmpegStream
      .output(target)
    await this._options.format!(ffmpegStream) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (this._options.customFfmpegConfig != null) {
      await this._options.customFfmpegConfig(ffmpegStream)
    }

    const session = await this._page.target().createCDPSession()
    await this.configureSession(session)

    console.log('!!start')

    this._target = target
    this._session = session
    this._captureTimestamp = 0
    this._captureError = null
    this._framesStream = framesStream
    this._ffmpegStream = ffmpegStream
    this._ffmpegExited = new Promise((resolve, reject) => {
      ffmpegStream
        .on('start', (commandLine: string) => {
          console.log('Spawned Ffmpeg with command: ' + commandLine)
        })
        .on('stderr', (stderrLine: string) => {
          console.log('Stderr output: ' + stderrLine);
        })
        .on('error', reject)
        .on('end', resolve)
    })
    this._isCapturing = true
    await this.captureFrame()

    this._page.once('close', () => {
      this.onPageClose()
        .then(() => { })
        .catch(() => { })
    })

    this._ffmpegStream.run()

    console.log('!!started')
  }

  public async stop (): Promise<void> {
    console.log('!!stop')

    if (this._captureError != null) {
      const captureError = this._captureError
      this._captureError = null
      throw captureError
    }

    if (!this._isCapturing) {
      throw new Error('Capture is not in progress')
    }

    this._isCapturing = false

    while (this._frameBeingCaptured != null) {
      await this._frameBeingCaptured
    }

    if (this._framesStream != null) {
      console.log('END FRAMES STREAM')
      this._framesStream.end()
      this._framesStream = null
    }

    if (this._ffmpegExited != null) {
      console.log('waiting for ffmpeg')
      await this._ffmpegExited
      console.log('done waiting for ffmpeg')
    }

    if (this._ffmpegStream != null) {
      this._ffmpegStream = null
    }

    if (this._session != null) {
      await this.deconfigureSession(this._session)
      this._session = null
    }

    if (this._target != null) {
      this._target = null
    }

    console.log('!!stoped')
  }

  protected abstract configureSession (session: puppeteer.CDPSession): Promise<void>
  protected abstract deconfigureSession (session: puppeteer.CDPSession): Promise<void>
  protected abstract captureFrame (): Promise<void>

  protected async onFrameCaptured (timestamp: number, data: Buffer): Promise<void> {
    console.log('!!FRAME')

    this._framesStream?.write(data)
  }

  protected async onFrameCaptureError (reason?: any): Promise<void> {
    await this.stop()
    this._captureError = reason
  }

  protected async onPageClose (): Promise<void> {
    await this.stop()
    this._captureError = new Error('Page was closed')
  }

  protected async onOutputEnd (): Promise<void> {
  }

  private static async findFfmpeg (): Promise<string> {
    if (process.env.FFMPEG != null) {
      return process.env.FFMPEG
    }

    const systemFfmpeg = await which('node')
    if (systemFfmpeg != null) {
      return systemFfmpeg
    }

    try {
      const ffmpeg = require('@ffmpeg-installer/ffmpeg') // eslint-disable-line @typescript-eslint/no-var-requires
      return ffmpeg.path
    } catch (e) {}

    throw new Error('ffmpeg not available: specify FFMPEG environment variable, or make it available via PATH, or add @ffmpeg-installer/ffmpeg to the project')
  }
}
