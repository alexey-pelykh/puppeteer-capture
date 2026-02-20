import { PassThrough } from 'stream'
import { PuppeteerCaptureBase } from './PuppeteerCaptureBase'

jest.mock('which')
jest.mock('fluent-ffmpeg', () => {
  const mockStream: any = {
    input: jest.fn().mockReturnThis(),
    inputFormat: jest.fn().mockReturnThis(),
    inputFPS: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    outputFPS: jest.fn().mockReturnThis(),
    size: jest.fn().mockReturnThis(),
    outputFormat: jest.fn().mockReturnThis(),
    withVideoCodec: jest.fn().mockReturnThis(),
    outputOption: jest.fn().mockReturnThis(),
    run: jest.fn(),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    removeAllListeners: jest.fn().mockReturnThis(),
    emit: jest.fn().mockReturnThis()
  }

  mockStream.run.mockImplementation(() => {
    const startCall = mockStream.once.mock.calls.find(
      (call: any[]) => call[0] === 'start'
    )
    if (startCall != null) {
      startCall[1]()
    }
  })

  const factory: any = jest.fn(() => mockStream)
  return {
    __esModule: true,
    default: factory,
    setFfmpegPath: jest.fn(),
    _mockStream: mockStream
  }
})

class TestCapture extends PuppeteerCaptureBase {}

beforeEach(() => {
  const ffmpegMod = require('fluent-ffmpeg') // eslint-disable-line @typescript-eslint/no-var-requires
  const mockStream = ffmpegMod._mockStream
  for (const key of Object.keys(mockStream)) {
    if (typeof mockStream[key]?.mockClear === 'function') {
      mockStream[key].mockClear()
    }
  }
  // Re-setup chain returns after clearing
  mockStream.input.mockReturnThis()
  mockStream.inputFormat.mockReturnThis()
  mockStream.inputFPS.mockReturnThis()
  mockStream.output.mockReturnThis()
  mockStream.outputFPS.mockReturnThis()
  mockStream.size.mockReturnThis()
  mockStream.outputFormat.mockReturnThis()
  mockStream.withVideoCodec.mockReturnThis()
  mockStream.outputOption.mockReturnThis()
  mockStream.once.mockReturnThis()
  mockStream.off.mockReturnThis()
  mockStream.on.mockReturnThis()
  mockStream.removeAllListeners.mockReturnThis()
  mockStream.emit.mockReturnThis()
  // Re-setup run to trigger 'start' callback
  mockStream.run.mockImplementation(() => {
    const startCall = mockStream.once.mock.calls.find(
      (call: any[]) => call[0] === 'start'
    )
    if (startCall != null) {
      startCall[1]()
    }
  })
  ffmpegMod.default.mockClear()
})

function createMockPage (closed = false): any {
  return {
    isClosed: jest.fn().mockReturnValue(closed),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis()
  }
}

describe('constructor', () => {
  test('uses default options', () => {
    const capture = new TestCapture()
    expect(capture.page).toBeNull()
    expect(capture.isCapturing).toBe(false)
    expect(capture.captureTimestamp).toBe(0)
    expect(capture.capturedFrames).toBe(0)
    expect(capture.recordedFrames).toBe(0)
    expect(capture.dropCapturedFrames).toBe(false)
  })

  test('default fps is 60', () => {
    const capture = new TestCapture()
    expect(capture['_frameInterval']).toBeCloseTo(1000 / 60) // eslint-disable-line @typescript-eslint/dot-notation
  })

  test('accepts custom fps', () => {
    const capture = new TestCapture({ fps: 30 })
    expect(capture['_frameInterval']).toBeCloseTo(1000 / 30) // eslint-disable-line @typescript-eslint/dot-notation
  })

  test('throws when fps is null', () => {
    expect(() => new TestCapture({ fps: null as any })).toThrow(
      'options.fps needs to be set'
    )
  })

  test('throws when fps is undefined', () => {
    expect(() => new TestCapture({ fps: undefined })).toThrow(
      'options.fps needs to be set'
    )
  })

  test('throws when fps is negative', () => {
    expect(() => new TestCapture({ fps: -1 })).toThrow(
      'options.fps can not be set to -1'
    )
  })

  test('accepts fps of 0', () => {
    const capture = new TestCapture({ fps: 0 })
    expect(capture['_frameInterval']).toBe(Infinity) // eslint-disable-line @typescript-eslint/dot-notation
  })
})

describe('attach', () => {
  test('sets the page', async () => {
    const capture = new TestCapture()
    const page = createMockPage()
    await capture.attach(page)
    expect(capture.page).toBe(page)
  })

  test('throws when already attached', async () => {
    const capture = new TestCapture()
    await capture.attach(createMockPage())
    await expect(capture.attach(createMockPage())).rejects.toThrow(
      'Already attached to a page'
    )
  })
})

describe('detach', () => {
  test('clears the page', async () => {
    const capture = new TestCapture()
    await capture.attach(createMockPage())
    await capture.detach()
    expect(capture.page).toBeNull()
  })

  test('throws when not attached', async () => {
    const capture = new TestCapture()
    await expect(capture.detach()).rejects.toThrow(
      'Already detached from a page'
    )
  })

  test('allows re-attach after detach', async () => {
    const capture = new TestCapture()
    const page1 = createMockPage()
    const page2 = createMockPage()
    await capture.attach(page1)
    await capture.detach()
    await capture.attach(page2)
    expect(capture.page).toBe(page2)
  })
})

describe('start error paths', () => {
  test('throws when not attached', async () => {
    const capture = new TestCapture()
    await expect(capture.start(new PassThrough())).rejects.toThrow(
      'Not attached to a page'
    )
  })

  test('throws when page is closed', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage(true))
    await expect(capture.start(new PassThrough())).rejects.toThrow(
      'Can not start capturing a closed page'
    )
  })

  test('throws when capture is already in progress', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())
    capture['_isCapturing'] = true // eslint-disable-line @typescript-eslint/dot-notation
    await expect(capture.start(new PassThrough())).rejects.toThrow(
      'Capture is in progress'
    )
  })

  test('throws when waitForFirstFrame is null', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())
    await expect(
      capture.start(new PassThrough(), { waitForFirstFrame: null as any })
    ).rejects.toThrow('options.waitForFirstFrame can not be null or undefined')
  })

  test('throws when dropCapturedFrames is null', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())
    await expect(
      capture.start(new PassThrough(), { dropCapturedFrames: null as any })
    ).rejects.toThrow('options.dropCapturedFrames can not be null or undefined')
  })
})

describe('start', () => {
  test('emits captureStarted', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())

    const handler = jest.fn()
    capture.on('captureStarted', handler)
    await capture.start(new PassThrough(), { waitForFirstFrame: false })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(capture.isCapturing).toBe(true)
  })

  test('sets dropCapturedFrames from options', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())
    await capture.start(new PassThrough(), {
      waitForFirstFrame: false,
      dropCapturedFrames: true
    })
    expect(capture.dropCapturedFrames).toBe(true)
  })

  test('uses default start options', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())
    await capture.start(new PassThrough(), { waitForFirstFrame: false })
    expect(capture.dropCapturedFrames).toBe(false)
  })
})

describe('stop', () => {
  test('rethrows stored error', async () => {
    const capture = new TestCapture()
    capture['_error'] = new Error('stored error') // eslint-disable-line @typescript-eslint/dot-notation
    await expect(capture.stop()).rejects.toThrow('stored error')
  })

  test('clears stored error after rethrowing', async () => {
    const capture = new TestCapture()
    capture['_error'] = new Error('stored error') // eslint-disable-line @typescript-eslint/dot-notation
    try { await capture.stop() } catch {}
    expect(capture['_error']).toBeNull() // eslint-disable-line @typescript-eslint/dot-notation
  })

  test('emits captureStopped', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())

    // Set up minimal state for _stop to succeed
    capture['_isCapturing'] = true // eslint-disable-line @typescript-eslint/dot-notation

    const handler = jest.fn()
    capture.on('captureStopped', handler)
    await capture.stop()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(capture.isCapturing).toBe(false)
  })
})

describe('waitForTimeout', () => {
  test('throws when not capturing', async () => {
    const capture = new TestCapture()
    await expect(capture.waitForTimeout(100)).rejects.toThrow(
      'Can not wait for timeout while not capturing'
    )
  })
})

describe('dropCapturedFrames', () => {
  test('getter returns current value', () => {
    const capture = new TestCapture()
    expect(capture.dropCapturedFrames).toBe(false)
  })

  test('setter updates value', () => {
    const capture = new TestCapture()
    capture.dropCapturedFrames = true
    expect(capture.dropCapturedFrames).toBe(true)
  })
})

describe('onFrameCaptured', () => {
  test('emits frameCaptured event', async () => {
    const capture = new TestCapture()
    const handler = jest.fn()
    capture.on('frameCaptured', handler)

    const data = Buffer.from('frame-data')
    await capture['onFrameCaptured'](100, data) // eslint-disable-line @typescript-eslint/dot-notation

    expect(handler).toHaveBeenCalledWith(0, 100, data)
  })

  test('increments capturedFrames', async () => {
    const capture = new TestCapture()
    await capture['onFrameCaptured'](0, Buffer.from('a')) // eslint-disable-line @typescript-eslint/dot-notation
    await capture['onFrameCaptured'](16, Buffer.from('b')) // eslint-disable-line @typescript-eslint/dot-notation
    expect(capture.capturedFrames).toBe(2)
  })

  test('emits frameRecorded when not dropping frames', async () => {
    const capture = new TestCapture()
    capture['_framesStream'] = new PassThrough() // eslint-disable-line @typescript-eslint/dot-notation

    const handler = jest.fn()
    capture.on('frameRecorded', handler)

    const data = Buffer.from('frame-data')
    await capture['onFrameCaptured'](100, data) // eslint-disable-line @typescript-eslint/dot-notation

    expect(handler).toHaveBeenCalledWith(0, 100, data)
    expect(capture.recordedFrames).toBe(1)
  })

  test('skips frameRecorded when dropping frames', async () => {
    const capture = new TestCapture()
    capture['_framesStream'] = new PassThrough() // eslint-disable-line @typescript-eslint/dot-notation
    capture.dropCapturedFrames = true

    const handler = jest.fn()
    capture.on('frameRecorded', handler)

    await capture['onFrameCaptured'](100, Buffer.from('frame-data')) // eslint-disable-line @typescript-eslint/dot-notation

    expect(handler).not.toHaveBeenCalled()
    expect(capture.recordedFrames).toBe(0)
    expect(capture.capturedFrames).toBe(1)
  })
})

describe('onFrameCaptureFailed', () => {
  test('emits frameCaptureFailed and stores error', async () => {
    const capture = new TestCapture({ ffmpeg: '/mock/ffmpeg' })
    await capture.attach(createMockPage())
    capture['_isCapturing'] = true // eslint-disable-line @typescript-eslint/dot-notation

    const handler = jest.fn()
    capture.on('frameCaptureFailed', handler)

    const error = new Error('capture failed')
    await capture['onFrameCaptureFailed'](error) // eslint-disable-line @typescript-eslint/dot-notation

    expect(handler).toHaveBeenCalledWith(error)
    expect(capture['_error']).toBe(error) // eslint-disable-line @typescript-eslint/dot-notation
  })
})

describe('onPageClose', () => {
  test('stores Page was closed error', () => {
    const capture = new TestCapture()
    capture['_page'] = createMockPage() // eslint-disable-line @typescript-eslint/dot-notation
    capture['onPageClose']() // eslint-disable-line @typescript-eslint/dot-notation
    expect(capture['_error']).toBeInstanceOf(Error) // eslint-disable-line @typescript-eslint/dot-notation
    expect(capture['_error'].message).toBe('Page was closed') // eslint-disable-line @typescript-eslint/dot-notation
  })
})

describe('findFfmpeg', () => {
  const originalFfmpeg = process.env.FFMPEG

  afterEach(() => {
    if (originalFfmpeg === undefined) {
      delete process.env.FFMPEG
    } else {
      process.env.FFMPEG = originalFfmpeg
    }
  })

  test('returns FFMPEG env var when set', async () => {
    process.env.FFMPEG = '/custom/ffmpeg'
    const result = await (PuppeteerCaptureBase as any).findFfmpeg()
    expect(result).toBe('/custom/ffmpeg')
  })

  test('returns which result when env var is not set', async () => {
    delete process.env.FFMPEG
    const which = require('which') as jest.Mock // eslint-disable-line @typescript-eslint/no-var-requires
    which.mockResolvedValueOnce('/usr/bin/ffmpeg')
    const result = await (PuppeteerCaptureBase as any).findFfmpeg()
    expect(result).toBe('/usr/bin/ffmpeg')
  })

  test('falls back to ffmpeg-static when which fails', async () => {
    delete process.env.FFMPEG
    const which = require('which') as jest.Mock // eslint-disable-line @typescript-eslint/no-var-requires
    which.mockRejectedValueOnce(new Error('not found'))
    const result = await (PuppeteerCaptureBase as any).findFfmpeg()
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  test('throws when no ffmpeg is available', async () => {
    delete process.env.FFMPEG

    jest.resetModules()
    jest.doMock('which', () => jest.fn().mockRejectedValue(new Error('not found')))
    jest.doMock('ffmpeg-static', () => { throw new Error('Cannot find module') })

    const { PuppeteerCaptureBase: FreshBase } = require('./PuppeteerCaptureBase') // eslint-disable-line @typescript-eslint/no-var-requires
    await expect(FreshBase.findFfmpeg()).rejects.toThrow(
      'ffmpeg not available'
    )
  })
})

describe('DEFAULT_OPTIONS', () => {
  test('fps is 60', () => {
    expect(PuppeteerCaptureBase.DEFAULT_OPTIONS.fps).toBe(60)
  })

  test('format is defined', () => {
    expect(typeof PuppeteerCaptureBase.DEFAULT_OPTIONS.format).toBe('function')
  })
})

describe('DEFAULT_START_OPTIONS', () => {
  test('waitForFirstFrame is true', () => {
    expect(PuppeteerCaptureBase.DEFAULT_START_OPTIONS.waitForFirstFrame).toBe(true)
  })

  test('dropCapturedFrames is false', () => {
    expect(PuppeteerCaptureBase.DEFAULT_START_OPTIONS.dropCapturedFrames).toBe(false)
  })
})
