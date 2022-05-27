import { Mutex } from 'async-mutex'
import ffmpeg, { FfmpegCommand, setFfmpegPath } from 'fluent-ffmpeg'
import { mkdir } from 'fs/promises'
import { EventEmitter } from 'node:events'
import { dirname } from 'path'
import puppeteer from 'puppeteer'
import { PassThrough, Writable } from 'stream'
import which from 'which'
import { PuppeteerCapture } from './PuppeteerCapture'
import { PuppeteerCaptureEvents } from './PuppeteerCaptureEvents'
import { MP4 } from './PuppeteerCaptureFormat'
import { PuppeteerCaptureOptions } from './PuppeteerCaptureOptions'
import { PuppeteerCaptureStartOptions } from './PuppeteerCaptureStartOptions'

export abstract class PuppeteerCaptureBase extends EventEmitter implements PuppeteerCapture {
  public static DEFAULT_OPTIONS: PuppeteerCaptureOptions = {
    fps: 60,
    format: MP4()
  }

  public static DEFAULT_START_OPTIONS: PuppeteerCaptureStartOptions = {
    waitForFirstFrame: true,
    dropCapturedFrames: false
  }

  protected readonly _page: puppeteer.Page
  protected readonly _options: PuppeteerCaptureOptions
  protected readonly _frameInterval: number
  protected readonly _captureFrame: () => void
  protected readonly _startStopMutex: Mutex
  protected _target: string | Writable | null
  protected _session: puppeteer.CDPSession | null
  protected _frameBeingCaptured: Promise<void> | null
  protected _captureTimestamp: number
  protected _capturedFrames: number
  protected _dropCapturedFrames: boolean
  protected _recordedFrames: number
  protected _error: any | null
  protected _framesStream: PassThrough | null
  protected _ffmpegStream: FfmpegCommand | null
  protected _ffmpegStarted: Promise<void> | null
  protected _ffmpegExited: Promise<void> | null
  protected _ffmpegExitedResolve: (() => void) | null
  protected _pageWaitForTimeout: ((milliseconds: number) => Promise<void>) | null
  protected _isCapturing: boolean

  public constructor (page: puppeteer.Page, options?: PuppeteerCaptureOptions) {
    super()

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
    this._startStopMutex = new Mutex()
    this._target = null
    this._session = null
    this._frameBeingCaptured = null
    this._captureTimestamp = 0
    this._capturedFrames = 0
    this._dropCapturedFrames = false
    this._recordedFrames = 0
    this._error = null
    this._framesStream = null
    this._ffmpegStream = null
    this._ffmpegStarted = null
    this._ffmpegExited = null
    this._ffmpegExitedResolve = null
    this._pageWaitForTimeout = null
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

  public get capturedFrames (): number {
    return this._capturedFrames
  }

  public get dropCapturedFrames (): boolean {
    return this._dropCapturedFrames
  }

  public set dropCapturedFrames (dropCaptiuredFrames: boolean) {
    this._dropCapturedFrames = dropCaptiuredFrames
  }

  public get recordedFrames (): number {
    return this._recordedFrames
  }

  public async start (target: string | Writable, options?: PuppeteerCaptureStartOptions): Promise<void> {
    await this._startStopMutex.runExclusive(async () => await this._start(target, options))
  }

  protected async _start (target: string | Writable, options?: PuppeteerCaptureStartOptions): Promise<void> {
    options = {
      ...PuppeteerCaptureBase.DEFAULT_START_OPTIONS,
      ...(options !== null ? options : {})
    }
    if (options.waitForFirstFrame == null) {
      throw new Error('options.waitForFirstFrame can not be null or undefined')
    }
    if (options.waitForFirstFrame == null) {
      throw new Error('options.waitForFirstFrame can not be null or undefined')
    }

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
    if (this._options.size != null) {
      ffmpegStream
        .size(this._options.size)
    }
    await this._options.format!(ffmpegStream) // eslint-disable-line @typescript-eslint/no-non-null-assertion
    if (this._options.customFfmpegConfig != null) {
      await this._options.customFfmpegConfig(ffmpegStream)
    }

    const session = await this._page.target().createCDPSession()
    await this.configureSession(session)

    this._target = target
    this._session = session
    this._captureTimestamp = 0
    this._capturedFrames = 0
    this._dropCapturedFrames = options.dropCapturedFrames! // eslint-disable-line @typescript-eslint/no-non-null-assertion
    this._recordedFrames = 0
    this._error = null
    this._framesStream = framesStream
    this._ffmpegStream = ffmpegStream
    this._ffmpegStarted = new Promise<void>((resolve, reject) => {
      const onStart = (): void => {
        ffmpegStream.off('error', onError)
        resolve()
      }
      const onError = (reason?: any): void => {
        ffmpegStream.off('start', onStart)
        reject(reason)
      }

      ffmpegStream
        .once('start', onStart)
        .once('error', onError)
    })
    this._ffmpegExited = new Promise<void>((resolve) => {
      this._ffmpegExitedResolve = resolve

      const onEnd = (): void => {
        ffmpegStream.off('error', onError)
        resolve()
      }
      const onError = (reason?: any): void => {
        ffmpegStream.off('end', onEnd)
        this._error = reason
        resolve()

        this._startStopMutex.runExclusive(async () => await this._stop())
          .then(() => { })
          .catch(() => { })
      }

      ffmpegStream
        .once('error', onError)
        .once('end', onEnd)
    })
    this._isCapturing = true
    await this.captureFrame()

    // TODO: redo
    this._page.once('close', () => {
      this.onPageClose()
        .then(() => { })
        .catch(() => { })
    })

    this._ffmpegStream.run()
    await this._ffmpegStarted

    this._pageWaitForTimeout = this._page.waitForTimeout
    this._page.waitForTimeout = async (milliseconds: number): Promise<void> => {
      await this.waitForTimeout(milliseconds)
    }

    this.emit('captureStarted')

    if (options.waitForFirstFrame) {
      await new Promise<void>((resolve, reject) => {
        const onFrameCaptured = (): void => {
          this.off('frameCaptureFailed', onFrameCaptureFailed)
          resolve()
        }
        const onFrameCaptureFailed = (reason?: any): void => {
          this.off('frameCaptured', onFrameCaptured)
          reject(reason)
        }

        this
          .once('frameCaptured', onFrameCaptured)
          .once('frameCaptureFailed', onFrameCaptureFailed)
      })
    }
  }

  public async stop (): Promise<void> {
    if (this._error != null) {
      const error = this._error
      this._error = null
      throw error
    }

    await this._startStopMutex.runExclusive(async () => await this._stop())
  }

  protected async _stop (): Promise<void> {
    if (!this._isCapturing) {
      throw new Error('Capture is not in progress')
    }

    this._isCapturing = false
    while (this._frameBeingCaptured != null) {
      await this._frameBeingCaptured
    }
    if (this._ffmpegStarted != null) {
      await this._ffmpegStarted
      this._ffmpegStarted = null
    }
    if (this._framesStream != null) {
      if (this._ffmpegStream != null) {
        this._ffmpegStream.removeAllListeners('error')
        this._ffmpegStream.once('error', () => {
          if (this._ffmpegExitedResolve != null) {
            this._ffmpegExitedResolve()
          }
        })
      }
      this._framesStream.end()
      this._framesStream = null
    }
    if (this._ffmpegExited != null) {
      await this._ffmpegExited
      this._ffmpegExited = null
      this._ffmpegExitedResolve = null
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

    if (this._pageWaitForTimeout != null) {
      this._page.waitForTimeout = this._pageWaitForTimeout
    }

    this.emit('captureStopped')
  }

  public async waitForTimeout (milliseconds: number): Promise<void> {
    if (!this._isCapturing) {
      throw new Error('Can not wait for timeout while not capturing')
    }

    const desiredCaptureTimestamp = this._captureTimestamp + milliseconds
    let waitPromiseResolve: () => void
    let waitPromiseReject: (reason?: any) => void
    const waitPromise = new Promise<void>((resolve, reject) => {
      waitPromiseResolve = resolve
      waitPromiseReject = reject
    })
    const onFrameCaptured = (): void => {
      if (this._captureTimestamp < desiredCaptureTimestamp) {
        return
      }

      this
        .off('frameCaptured', onFrameCaptured)
        .off('frameCaptureFailed', onFrameCaptureFailed)
      waitPromiseResolve()
    }
    const onFrameCaptureFailed = (reason?: any): void => {
      this
        .off('frameCaptured', onFrameCaptured)
        .off('frameCaptureFailed', onFrameCaptureFailed)
      waitPromiseReject(reason)
    }

    this
      .on('frameCaptured', onFrameCaptured)
      .on('frameCaptureFailed', onFrameCaptureFailed)

    await waitPromise
  }

  public override emit<Event extends keyof PuppeteerCaptureEvents>(eventName: Event, ...args: Parameters<PuppeteerCaptureEvents[Event]>): boolean {
    return super.emit(eventName, ...args)
  }

  protected abstract configureSession (session: puppeteer.CDPSession): Promise<void>
  protected abstract deconfigureSession (session: puppeteer.CDPSession): Promise<void>
  protected abstract captureFrame (): Promise<void>

  protected async onFrameCaptured (timestamp: number, data: Buffer): Promise<void> {
    this.emit('frameCaptured', this._capturedFrames, timestamp, data)
    this._capturedFrames += 1

    if (this._dropCapturedFrames) {
      return
    }

    this._framesStream?.write(data)
    this.emit('frameRecorded', this._recordedFrames, timestamp, data)
    this._recordedFrames += 1
  }

  protected async onFrameCaptureFailed (reason?: any): Promise<void> {
    await this.stop()
    this._error = reason
    this.emit('frameCaptureFailed', reason)
  }

  protected async onPageClose (): Promise<void> {
    await this.stop()
    this._error = new Error('Page was closed')
  }

  protected async onOutputEnd (): Promise<void> {
  }

  private static async findFfmpeg (): Promise<string> {
    if (process.env.FFMPEG != null) {
      return process.env.FFMPEG
    }

    const systemFfmpeg = await which('ffmpeg')
    if (systemFfmpeg != null) {
      return systemFfmpeg
    }

    try {
      const ffmpeg = require('@ffmpeg-installer/ffmpeg') // eslint-disable-line @typescript-eslint/no-var-requires
      return ffmpeg.path
    } catch (e) { }

    throw new Error('ffmpeg not available: specify FFMPEG environment variable, or make it available via PATH, or add @ffmpeg-installer/ffmpeg to the project')
  }
}
