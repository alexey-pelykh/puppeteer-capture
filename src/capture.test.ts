import { capture } from './capture'

const mockAttach = jest.fn()
jest.mock('./PuppeteerCaptureViaHeadlessExperimental', () => ({
  PuppeteerCaptureViaHeadlessExperimental: jest.fn().mockImplementation(() => ({
    attach: mockAttach
  }))
}))

const { PuppeteerCaptureViaHeadlessExperimental } = require('./PuppeteerCaptureViaHeadlessExperimental') // eslint-disable-line @typescript-eslint/no-var-requires

beforeEach(() => {
  jest.clearAllMocks()
})

test('capture() creates instance and attaches to page by default', async () => {
  const mockPage = {} as any
  await capture(mockPage)
  expect(PuppeteerCaptureViaHeadlessExperimental).toHaveBeenCalledTimes(1)
  expect(mockAttach).toHaveBeenCalledWith(mockPage)
})

test('capture() passes options to constructor', async () => {
  const mockPage = {} as any
  const options = { fps: 30 }
  await capture(mockPage, options)
  expect(PuppeteerCaptureViaHeadlessExperimental).toHaveBeenCalledWith(options)
})

test('capture() with attach: false does not attach', async () => {
  const mockPage = {} as any
  await capture(mockPage, { attach: false })
  expect(PuppeteerCaptureViaHeadlessExperimental).toHaveBeenCalledTimes(1)
  expect(mockAttach).not.toHaveBeenCalled()
})

test('capture() with attach: true attaches', async () => {
  const mockPage = {} as any
  await capture(mockPage, { attach: true })
  expect(mockAttach).toHaveBeenCalledWith(mockPage)
})
