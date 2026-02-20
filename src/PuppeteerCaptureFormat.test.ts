import { MP4 } from './PuppeteerCaptureFormat'

function createMockFfmpegCommand (): any {
  const mock: any = {}
  mock.outputFormat = jest.fn().mockReturnValue(mock)
  mock.withVideoCodec = jest.fn().mockReturnValue(mock)
  mock.outputOption = jest.fn().mockReturnValue(mock)
  return mock
}

test('MP4() uses ultrafast preset and libx264 by default', async () => {
  const format = MP4()
  const ffmpeg = createMockFfmpegCommand()
  await format(ffmpeg)
  expect(ffmpeg.outputFormat).toHaveBeenCalledWith('mp4')
  expect(ffmpeg.withVideoCodec).toHaveBeenCalledWith('libx264')
  expect(ffmpeg.outputOption).toHaveBeenCalledWith('-preset ultrafast')
  expect(ffmpeg.outputOption).toHaveBeenCalledWith('-movflags +frag_keyframe+separate_moof+omit_tfhd_offset+empty_moov')
})

test('MP4() uses custom preset', async () => {
  const format = MP4('slow')
  const ffmpeg = createMockFfmpegCommand()
  await format(ffmpeg)
  expect(ffmpeg.outputOption).toHaveBeenCalledWith('-preset slow')
})

test('MP4() uses custom video codec', async () => {
  const format = MP4('ultrafast', 'libx265')
  const ffmpeg = createMockFfmpegCommand()
  await format(ffmpeg)
  expect(ffmpeg.withVideoCodec).toHaveBeenCalledWith('libx265')
})

test('MP4() returns an async function', () => {
  const format = MP4()
  expect(typeof format).toBe('function')
})
