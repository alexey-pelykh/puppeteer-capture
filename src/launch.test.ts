import { launch } from './launch'

jest.mock('puppeteer-core', () => ({
  __esModule: true,
  default: { launch: jest.fn().mockResolvedValue({}) }
}))

jest.mock('./PuppeteerCaptureViaHeadlessExperimental', () => ({
  PuppeteerCaptureViaHeadlessExperimental: {
    REQUIRED_ARGS: ['--deterministic-mode', '--enable-begin-frame-control']
  }
}))

const puppeteerMock = require('puppeteer-core') // eslint-disable-line @typescript-eslint/no-var-requires
const mockLaunch = puppeteerMock.default.launch as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
})

test('launch() with no options sets headless shell and required args', async () => {
  await launch()
  expect(mockLaunch).toHaveBeenCalledWith({
    headless: 'shell',
    args: ['--deterministic-mode', '--enable-begin-frame-control']
  })
})

test('launch() merges custom args with required args', async () => {
  await launch({ args: ['--no-sandbox'] })
  expect(mockLaunch).toHaveBeenCalledWith({
    headless: 'shell',
    args: ['--no-sandbox', '--deterministic-mode', '--enable-begin-frame-control']
  })
})

test('launch() overrides headless option to shell', async () => {
  await launch({ headless: true } as any)
  expect(mockLaunch).toHaveBeenCalledWith(
    expect.objectContaining({ headless: 'shell' })
  )
})

test('launch() preserves other options', async () => {
  await launch({ slowMo: 50 })
  expect(mockLaunch).toHaveBeenCalledWith(
    expect.objectContaining({ slowMo: 50 })
  )
})
